import {
  CommandPermissionLevel,
  CustomCommandRegistry,
  CustomCommandStatus,
  Player,
  system,
  world,
} from "@minecraft/server";

import {
  ADDON_VERSION,
  IDENTIFIERS,
  STARTER_ISLAND,
} from "../config/constants";
import { ensureRequiredIslandsQueued } from "../generation/service";
import {
  ARCHIPELAGO_CONFIG,
  parseArchipelagoIslandId,
} from "../generation/archipelago";
import { parseArchipelagoV3IslandId } from "../generation/archipelago-v3";
import {
  ARCHIPELAGO_V4_CONFIG,
  parseArchipelagoV4IslandId,
} from "../generation/archipelago-v4";
import {
  ARCHIPELAGO_LAYOUT_VERSION,
  isArchipelagoIslandId,
  nextArchipelagoGenerationJob,
} from "../generation/archipelago-runtime";
import { parseContinentStreamingId } from "../generation/continent-streaming";
import {
  isArchipelagoGenerationPaused,
  pauseArchipelagoGeneration,
  resumeArchipelagoGeneration,
} from "../generation/archipelago-control";
import { recoverPlayer } from "../gameplay/recovery";
import {
  DeveloperTestSetupReport,
  prepareDeveloperTestSetup,
} from "../gameplay/developer-test-setup";
import { DEVELOPER_TEST_SETUP } from "../gameplay/developer-test-setup-layout";
import { spawnSkyRaiderForPlayer } from "../gameplay/sky-raider";
import {
  loadShipState,
  spawnSkiffForPlayer,
  spawnSkycutterForPlayer,
} from "../gameplay/skiff";
import { getSkiffSpawnLocation } from "../gameplay/skiff-placement";
import { clearTestBench, placeTestBench } from "../gameplay/testbench";
import { announceObjective } from "../gameplay/tutorial";
import {
  PlayerStateRepository,
  WorldStateRepository,
} from "../persistence/repositories";
import { Logger } from "./logger";

function commandPlayer(source: unknown): Player | undefined {
  return source instanceof Player ? source : undefined;
}

// Heights well below the authored realm, spread across the Overworld range. A
// world created from the void template has nothing here; a normal world keeps
// vanilla terrain, which is a supported compatibility mode but not the
// intended presentation.
const VOID_PROBE_HEIGHTS = [128, 96, 64, 32, 0, -32];
const VOID_PROBE_OFFSETS = [-16, 0, 16];

/**
 * Reports whether the space beneath the realm is empty.
 *
 * The `0.3.5` playtest was run on a normal Infinite world with the development
 * packs rather than on a world created from the packaged template, and nothing
 * in game said so. This line makes the world type self-evident before a tester
 * spends a session on the wrong presentation.
 */
function describeTerrainBelowRealm(player: Player): string {
  const origin = player.location;
  let checked = 0;
  let solid = 0;

  for (const dx of VOID_PROBE_OFFSETS) {
    for (const dz of VOID_PROBE_OFFSETS) {
      for (const y of VOID_PROBE_HEIGHTS) {
        let block;

        try {
          block = player.dimension.getBlock({
            x: Math.floor(origin.x) + dx,
            y,
            z: Math.floor(origin.z) + dz,
          });
        } catch {
          // An unloaded or out-of-range probe is not evidence either way.
          continue;
        }

        if (block === undefined) {
          continue;
        }

        checked += 1;

        if (!block.isAir) {
          solid += 1;
        }
      }
    }
  }

  if (checked === 0) {
    return "unknown (no loaded probe)";
  }

  return solid === 0
    ? `void (${checked} probes clear)`
    : `§cvanilla terrain§r (${solid}/${checked} probes solid — not the void template)`;
}

export function registerDevelopmentCommands(
  registry: CustomCommandRegistry,
  worldRepository: WorldStateRepository,
  logger: Logger,
): void {
  registry.registerCommand(
    {
      name: "skyknights:debug",
      description: "Show Sky Knights runtime state.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
    },
    (origin) => {
      const player = commandPlayer(origin.sourceEntity);

      if (player === undefined) {
        return {
          status: CustomCommandStatus.Failure,
          message: "Run this command as a player.",
        };
      }

      system.run(() => sendDebugReport(player, worldRepository));
      return { status: CustomCommandStatus.Success };
    },
  );

  registry.registerCommand(
    {
      name: "skyknights:archipelago_pause",
      description: "Developer aid: pause new ambient-island queueing.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
    },
    () => {
      pauseArchipelagoGeneration();
      return {
        status: CustomCommandStatus.Success,
        message:
          "Ambient-island queueing paused. An already active job can still finish.",
      };
    },
  );

  registry.registerCommand(
    {
      name: "skyknights:archipelago_resume",
      description: "Developer aid: resume ambient-island queueing.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
    },
    () => {
      resumeArchipelagoGeneration();
      return {
        status: CustomCommandStatus.Success,
        message: "Ambient-island queueing resumed.",
      };
    },
  );

  registry.registerCommand(
    {
      name: "skyknights:skycutter",
      description: "Developer shortcut: spawn a configured Skycutter.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
    },
    (origin) => {
      const player = commandPlayer(origin.sourceEntity);

      if (player === undefined) {
        return {
          status: CustomCommandStatus.Failure,
          message: "Run this command as a player.",
        };
      }

      system.run(() =>
        spawnSkycutterForPlayer(
          player,
          logger.child("skycutter"),
          getSkiffSpawnLocation(player.location, player.getViewDirection()),
        ),
      );
      return {
        status: CustomCommandStatus.Success,
        message: "Spawning a configured Skycutter.",
      };
    },
  );

  registry.registerCommand(
    {
      name: "skyknights:skiff",
      description: "Developer shortcut: spawn a Sky Knights skiff.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
    },
    (origin) => {
      const player = commandPlayer(origin.sourceEntity);

      if (player === undefined) {
        return {
          status: CustomCommandStatus.Failure,
          message: "Run this command as a player.",
        };
      }

      system.run(() => spawnSkiffForPlayer(player, logger.child("skiff")));
      return {
        status: CustomCommandStatus.Success,
        message: "Spawning a gray-box skiff.",
      };
    },
  );

  registry.registerCommand(
    {
      name: "skyknights:outrigger",
      description: "Developer shortcut: spawn the Aether Outrigger prototype.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
    },
    (origin) => {
      const player = commandPlayer(origin.sourceEntity);

      if (player === undefined) {
        return {
          status: CustomCommandStatus.Failure,
          message: "Run this command as a player.",
        };
      }

      system.run(() => {
        const craft = player.dimension.spawnEntity(
          IDENTIFIERS.aetherOutrigger,
          getSkiffSpawnLocation(player.location, player.getViewDirection()),
          { initialPersistence: true },
        );
        craft.nameTag = "Aether Outrigger Prototype";
        logger.info("Aether Outrigger prototype spawned.", {
          playerId: player.id,
          entityId: craft.id,
          dimensionId: craft.dimension.id,
        });
      });
      return {
        status: CustomCommandStatus.Success,
        message: "Spawning the Aether Outrigger prototype.",
      };
    },
  );

  registry.registerCommand(
    {
      name: "skyknights:blimp",
      description: "Developer shortcut: spawn the Steampunk Blimp prototype.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
    },
    (origin) => {
      const player = commandPlayer(origin.sourceEntity);

      if (player === undefined) {
        return {
          status: CustomCommandStatus.Failure,
          message: "Run this command as a player.",
        };
      }

      system.run(() => {
        const direction = player.getViewDirection();
        const craft = player.dimension.spawnEntity(
          IDENTIFIERS.steampunkBlimp,
          {
            x: player.location.x + direction.x * 9,
            y: player.location.y + 2,
            z: player.location.z + direction.z * 9,
          },
          { initialPersistence: true },
        );
        craft.nameTag = "Steampunk Blimp Prototype";
        logger.info("Steampunk Blimp prototype spawned.", {
          playerId: player.id,
          entityId: craft.id,
          dimensionId: craft.dimension.id,
        });
      });
      return {
        status: CustomCommandStatus.Success,
        message: "Spawning the Steampunk Blimp prototype.",
      };
    },
  );

  registry.registerCommand(
    {
      name: "skyknights:testbench",
      description:
        "Developer shortcut: place a labelled row of stocked barrels on the starter island.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
    },
    (origin) => {
      const player = commandPlayer(origin.sourceEntity);

      if (player === undefined) {
        return {
          status: CustomCommandStatus.Failure,
          message: "Run this command as a player.",
        };
      }

      system.run(() => {
        const report = placeTestBench(logger.child("testbench"));
        player.sendMessage(
          `§bTest bench:§r placed ${report.placed.length} stalls north of the dock.`,
        );

        for (const stall of report.skipped) {
          player.sendMessage(`§cSkipped ${stall.id}: ${stall.reason}§r`);
        }
      });
      return { status: CustomCommandStatus.Success };
    },
  );

  registry.registerCommand(
    {
      name: "skyknights:test_setup",
      description:
        "Developer shortcut: prepare the starter inspection hub, fleet, blueprints, and Raider.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
    },
    (origin) => {
      const player = commandPlayer(origin.sourceEntity);

      if (player === undefined) {
        return {
          status: CustomCommandStatus.Failure,
          message: "Run this command as a player.",
        };
      }

      system.run(() => {
        player.sendMessage(
          "§bDeveloper setup:§r waiting for required islands, then preparing the starter dock.",
        );
        void prepareDeveloperTestSetup(
          player,
          worldRepository,
          logger.child("test-setup"),
        )
          .then((report) => sendDeveloperSetupReport(player, report))
          .catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : String(error);
            logger.error("Developer test setup failed.", {
              playerId: player.id,
              error: message,
            });
            if (player.isValid) {
              player.sendMessage(`§cDeveloper setup failed: ${message}§r`);
            }
          });
      });
      return {
        status: CustomCommandStatus.Success,
        message: "Preparing the developer test setup.",
      };
    },
  );

  registry.registerCommand(
    {
      name: "skyknights:testbench_clear",
      description: "Developer shortcut: remove the starter-island test bench.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
    },
    (origin) => {
      const player = commandPlayer(origin.sourceEntity);

      if (player === undefined) {
        return {
          status: CustomCommandStatus.Failure,
          message: "Run this command as a player.",
        };
      }

      system.run(() => {
        const removed = clearTestBench(logger.child("testbench"));
        player.sendMessage(`§bTest bench:§r removed ${removed} blocks.`);
      });
      return { status: CustomCommandStatus.Success };
    },
  );

  registry.registerCommand(
    {
      name: "skyknights:objective",
      description: "Show the current Sky Knights objective.",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const player = commandPlayer(origin.sourceEntity);

      if (player === undefined) {
        return {
          status: CustomCommandStatus.Failure,
          message: "Run this command as a player.",
        };
      }

      system.run(() => {
        const state = new PlayerStateRepository(
          player,
          STARTER_ISLAND.safeDock,
        ).load();
        announceObjective(player, state.objective, false);
      });
      return { status: CustomCommandStatus.Success };
    },
  );

  registry.registerCommand(
    {
      name: "skyknights:recover",
      description: "Return to the last safe Sky Knights dock.",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const player = commandPlayer(origin.sourceEntity);

      if (player === undefined) {
        return {
          status: CustomCommandStatus.Failure,
          message: "Run this command as a player.",
        };
      }

      system.run(() =>
        recoverPlayer(player, worldRepository, logger.child("recovery")),
      );
      return { status: CustomCommandStatus.Success };
    },
  );

  registry.registerCommand(
    {
      name: "skyknights:island",
      description: "Resume required-island generation.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
    },
    () => {
      system.run(() =>
        ensureRequiredIslandsQueued(
          worldRepository,
          logger.child("generation"),
        ),
      );
      return {
        status: CustomCommandStatus.Success,
        message: "Required-island generation resumed.",
      };
    },
  );

  registry.registerCommand(
    {
      name: "skyknights:raider",
      description: "Developer shortcut: reset and spawn the Ashwing Raider.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
    },
    (origin) => {
      const player = commandPlayer(origin.sourceEntity);

      if (player === undefined) {
        return {
          status: CustomCommandStatus.Failure,
          message: "Run this command as a player.",
        };
      }

      system.run(() =>
        spawnSkyRaiderForPlayer(
          player,
          worldRepository,
          logger.child("raider"),
          true,
        ),
      );
      return {
        status: CustomCommandStatus.Success,
        message: "Resetting and spawning the Ashwing Raider.",
      };
    },
  );
}

function sendDeveloperSetupReport(
  player: Player,
  report: DeveloperTestSetupReport,
): void {
  if (!player.isValid) {
    return;
  }

  player.sendMessage(
    `§aDeveloper setup ready:§r ${report.spawnedCraft.length} craft, ${report.berths.prepared}/5 berths, ${report.benchStalls.placed}/8 bench stalls, ${report.referenceBlueprints.length} reference blueprints, Raider ${
      report.raiderReady ? "ready" : "missing"
    }.`,
  );
  player.sendMessage(
    `§bInspection route:§r ${DEVELOPER_TEST_SETUP.route
      .map(
        (stop) =>
          `${stop.label} (${stop.location.x}, ${stop.location.y}, ${stop.location.z})`,
      )
      .join(" -> ")}`,
  );
  player.sendMessage(
    "§eUse Dockmaster Elian to build one reference Skycraft at a time; rerun /skyknights:test_setup to restock and reset the tagged fleet.§r",
  );

  for (const warning of report.benchStalls.skipped) {
    player.sendMessage(`§cBench warning: ${warning}§r`);
  }
  for (const berthId of report.berths.skipped) {
    player.sendMessage(`§cBerth warning: ${berthId} is obstructed.§r`);
  }
  if (!report.dockmasterReady) {
    player.sendMessage(
      "§cDockmaster warning: the authored dock was not ready.§r",
    );
  }
}

function sendDebugReport(
  player: Player,
  repository: WorldStateRepository,
): void {
  const state = repository.load();
  const skiffCount = player.dimension.getEntities({
    type: IDENTIFIERS.skiff,
  }).length;
  const dockmasterCount = player.dimension.getEntities({
    type: IDENTIFIERS.dockmaster,
  }).length;
  const skycutterCount = player.dimension.getEntities({
    type: IDENTIFIERS.skycutter,
  }).length;
  const outriggerCount = player.dimension.getEntities({
    type: IDENTIFIERS.aetherOutrigger,
  }).length;
  const blimpCount = player.dimension.getEntities({
    type: IDENTIFIERS.steampunkBlimp,
  }).length;
  const raiderCount = player.dimension.getEntities({
    type: IDENTIFIERS.skyRaider,
  }).length;
  const playerState = new PlayerStateRepository(
    player,
    STARTER_ISLAND.safeDock,
  ).load();
  const ownedEntity =
    playerState.ownedShip?.entityId === undefined
      ? undefined
      : world.getEntity(playerState.ownedShip.entityId);
  const shipState =
    ownedEntity === undefined ? undefined : loadShipState(ownedEntity);
  const layoutRecords = Object.keys(state.islandLayout)
    .sort()
    .map((id) => state.islandLayout[id]);
  const modifiedIslandIds = layoutRecords
    .filter((record) => record.playerModified)
    .map((record) => record.id);
  const ambientIslandIds = state.generatedIslandIds.filter((id) =>
    isArchipelagoIslandId(state, id),
  );
  const v4AmbientIslands = [];
  const v3AmbientIslands = [];
  const v2AmbientIslands = [];
  let formulaContinentCount = 0;

  for (const id of ambientIslandIds) {
    if (parseContinentStreamingId(id) !== undefined) {
      formulaContinentCount += 1;
      continue;
    }

    const v4Island = parseArchipelagoV4IslandId(state.worldSeed, id);

    if (v4Island !== undefined) {
      v4AmbientIslands.push(v4Island);
      continue;
    }

    const v3Island = parseArchipelagoV3IslandId(state.worldSeed, id);

    if (v3Island !== undefined) {
      v3AmbientIslands.push(v3Island);
      continue;
    }

    const v2Island = parseArchipelagoIslandId(
      state.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
      id,
    );

    if (v2Island !== undefined) {
      v2AmbientIslands.push(v2Island);
    }
  }
  const soloAmbientCount = v4AmbientIslands.length;
  const archivedA3Count = v3AmbientIslands.length;
  const archivedA2Count = v2AmbientIslands.filter(
    (island) => island.tier !== "continent",
  ).length;
  const archivedA2ContinentCount = v2AmbientIslands.filter(
    (island) => island.tier === "continent",
  ).length;
  const continentCount = formulaContinentCount + archivedA2ContinentCount;
  const archivedA1Count = state.generatedIslandIds.filter((id) =>
    id.startsWith("a1_"),
  ).length;
  const authoredIslandIds = state.generatedIslandIds.filter(
    (id) => !isArchipelagoIslandId(state, id) && !id.startsWith("a1_"),
  );
  const nextAmbient = nextArchipelagoGenerationJob(state, [
    {
      dimensionId: player.dimension.id,
      x: player.location.x,
      z: player.location.z,
    },
  ]);

  player.sendMessage(`§bSky Knights debug v${ADDON_VERSION}§r`);
  player.sendMessage(`below=${describeTerrainBelowRealm(player)}`);
  player.sendMessage(
    `schema=${state.schemaVersion} seed=${state.seed} worldSeed=${state.worldSeed} profile=${state.worldProfile} layoutVersion=${state.layoutVersion} control=${player.getControlScheme()}`,
  );
  player.sendMessage(
    `islands=${authoredIslandIds.join(",") || "none"} activeJob=${
      state.activeGeneration === undefined
        ? "none"
        : `${state.activeGeneration.id}:${state.activeGeneration.stage}`
    }`,
  );
  player.sendMessage(
    `archipelago=${soloAmbientCount}/${ARCHIPELAGO_V4_CONFIG.maxGeneratedIslands} continents=${continentCount}/${ARCHIPELAGO_CONFIG.maxGeneratedContinents} formulaC1=${formulaContinentCount} archivedA2Continents=${archivedA2ContinentCount} archivedA3=${archivedA3Count} archivedA2=${archivedA2Count} archivedA1=${archivedA1Count} paused=${isArchipelagoGenerationPaused()} next=${
      nextAmbient === undefined
        ? "none"
        : `${nextAmbient.id}@${nextAmbient.origin.x},${nextAmbient.origin.y},${nextAmbient.origin.z}`
    }`,
  );
  const islandVersions: string[] = [];

  for (const id in state.islandVersions) {
    if (!isArchipelagoIslandId(state, id) && !id.startsWith("a1_")) {
      islandVersions.push(`${id}:v${state.islandVersions[id]}`);
    }
  }

  player.sendMessage(
    `islandVersions=${islandVersions.join(",") || "none"} ambientVersioned=${ambientIslandIds.length}`,
  );
  player.sendMessage(
    `layoutRecords=${layoutRecords.length} playerModified=${modifiedIslandIds.join(",") || "none"}`,
  );
  for (const record of layoutRecords) {
    player.sendMessage(
      `layout:${record.id}=${record.origin.x},${record.origin.y},${record.origin.z}:${record.placement}:${record.playerModified ? "modified" : "authored"}`,
    );
  }
  player.sendMessage(
    `skiffsHere=${skiffCount} skycuttersHere=${skycutterCount} outriggersHere=${outriggerCount} blimpsHere=${blimpCount} raidersHere=${raiderCount} dockmastersHere=${dockmasterCount}`,
  );
  player.sendMessage(
    `raiderEncounter=${state.skyRaiderEncounter.status}:${state.skyRaiderEncounter.entityId ?? "none"}`,
  );
  player.sendMessage(
    `objective=${playerState.objective} skycutterUnlocked=${playerState.skycutterUnlocked} ownedShip=${playerState.ownedShip?.frame ?? "none"}:${playerState.ownedShip?.entityId ?? "unavailable"}`,
  );
  if (shipState !== undefined) {
    const moduleText = (["hull", "engine", "cargo", "utility"] as const)
      .map(
        (slot) => `${slot}:${shipState.configuration.modules[slot] ?? "empty"}`,
      )
      .join(",");
    player.sendMessage(`modules=${moduleText}`);
    player.sendMessage(
      `combat=shots:${shipState.combat.shotsFired},hits:${shipState.combat.hits},raiders:${shipState.combat.raidersDefeated}`,
    );
  }
  player.sendMessage(
    `dynamicPropertyBytes=${world.getDynamicPropertyTotalByteCount()}`,
  );
  player.sendMessage(
    `homeDock=${STARTER_ISLAND.safeDock.x},${STARTER_ISLAND.safeDock.y},${STARTER_ISLAND.safeDock.z}`,
  );
}
