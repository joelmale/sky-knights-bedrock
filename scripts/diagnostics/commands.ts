import {
  CommandPermissionLevel,
  CustomCommandRegistry,
  CustomCommandStatus,
  Player,
  system,
  world,
} from "@minecraft/server";

import { IDENTIFIERS, STARTER_ISLAND } from "../config/constants";
import { ensureStarterIslandQueued } from "../generation/service";
import { recoverPlayer } from "../gameplay/recovery";
import {
  spawnSkiffForPlayer,
  spawnSkycutterForPlayer,
} from "../gameplay/skiff";
import { getSkiffSpawnLocation } from "../gameplay/skiff-placement";
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

      system.run(() => recoverPlayer(player, logger.child("recovery")));
      return { status: CustomCommandStatus.Success };
    },
  );

  registry.registerCommand(
    {
      name: "skyknights:island",
      description: "Requeue the starter-island generation proof.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
    },
    () => {
      system.run(() =>
        ensureStarterIslandQueued(
          worldRepository,
          logger.child("generation"),
          true,
        ),
      );
      return {
        status: CustomCommandStatus.Success,
        message: "Starter-island generation queued.",
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
  const playerState = new PlayerStateRepository(
    player,
    STARTER_ISLAND.safeDock,
  ).load();

  player.sendMessage("§bSky Knights debug§r");
  player.sendMessage(
    `schema=${state.schemaVersion} seed=${state.seed} control=${player.getControlScheme()}`,
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
    `skiffsHere=${skiffCount} skycuttersHere=${skycutterCount} dockmastersHere=${dockmasterCount}`,
  );
  player.sendMessage(
    `objective=${playerState.objective} skycutterUnlocked=${playerState.skycutterUnlocked} ownedShip=${playerState.ownedShip?.frame ?? "none"}:${playerState.ownedShip?.entityId ?? "unavailable"}`,
  );
  player.sendMessage(
    `dynamicPropertyBytes=${world.getDynamicPropertyTotalByteCount()}`,
  );
  player.sendMessage(
    `homeDock=${STARTER_ISLAND.safeDock.x},${STARTER_ISLAND.safeDock.y},${STARTER_ISLAND.safeDock.z}`,
  );
}
