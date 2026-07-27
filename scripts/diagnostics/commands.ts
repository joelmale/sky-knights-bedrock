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
import { recoverPlayer } from "../gameplay/recovery";
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

  player.sendMessage(`§bSky Knights debug v${ADDON_VERSION}§r`);
  player.sendMessage(
    `schema=${state.schemaVersion} seed=${state.seed} worldSeed=${state.worldSeed} profile=${state.worldProfile} layoutVersion=${state.layoutVersion} control=${player.getControlScheme()}`,
  );
  player.sendMessage(
    `islands=${state.generatedIslandIds.join(",") || "none"} activeJob=${
      state.activeGeneration === undefined
        ? "none"
        : `${state.activeGeneration.id}:${state.activeGeneration.stage}`
    }`,
  );
  const islandVersions: string[] = [];

  for (const id in state.islandVersions) {
    islandVersions.push(`${id}:v${state.islandVersions[id]}`);
  }

  player.sendMessage(`islandVersions=${islandVersions.join(",") || "none"}`);
  player.sendMessage(
    `layoutRecords=${layoutRecords.length} playerModified=${modifiedIslandIds.join(",") || "none"}`,
  );
  for (const record of layoutRecords) {
    player.sendMessage(
      `layout:${record.id}=${record.origin.x},${record.origin.y},${record.origin.z}:${record.placement}:${record.playerModified ? "modified" : "authored"}`,
    );
  }
  player.sendMessage(
    `skiffsHere=${skiffCount} skycuttersHere=${skycutterCount} raidersHere=${raiderCount} dockmastersHere=${dockmasterCount}`,
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
