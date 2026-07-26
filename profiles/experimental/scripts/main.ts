import {
  CommandPermissionLevel,
  CustomCommandStatus,
  Player,
  system,
  world,
} from "@minecraft/server";

const SKY_REALM = "skyknights:sky_realm";
const STARTER_ISLAND = "skyknights:starter_island";
const ISLAND_ORIGIN = { x: -7, y: 154, z: -7 };
const SKY_DOCK = { x: 9.5, y: 161, z: 0.5 };

system.beforeEvents.startup.subscribe(
  ({ customCommandRegistry, dimensionRegistry }) => {
    dimensionRegistry.registerCustomDimension(SKY_REALM);

    customCommandRegistry.registerCommand(
      {
        name: "skyknights:enter_sky_realm",
        description: "Enter the experimental Sky Knights dimension.",
        permissionLevel: CommandPermissionLevel.GameDirectors,
        cheatsRequired: true,
      },
      (origin) => {
        const player =
          origin.sourceEntity instanceof Player
            ? origin.sourceEntity
            : undefined;

        if (player === undefined) {
          return {
            status: CustomCommandStatus.Failure,
            message: "Run this command as a player.",
          };
        }

        system.run(() => enterSkyRealm(player));
        return {
          status: CustomCommandStatus.Success,
          message: "Entering the experimental sky realm.",
        };
      },
    );

    customCommandRegistry.registerCommand(
      {
        name: "skyknights:leave_sky_realm",
        description: "Return from the experimental Sky Knights dimension.",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin) => {
        const player =
          origin.sourceEntity instanceof Player
            ? origin.sourceEntity
            : undefined;

        if (player === undefined) {
          return {
            status: CustomCommandStatus.Failure,
            message: "Run this command as a player.",
          };
        }

        system.run(() => {
          player.teleport(
            { x: SKY_DOCK.x, y: SKY_DOCK.y, z: SKY_DOCK.z },
            { dimension: world.getDimension("minecraft:overworld") },
          );
        });
        return { status: CustomCommandStatus.Success };
      },
    );
  },
);

function enterSkyRealm(player: Player): void {
  const dimension = world.getDimension(SKY_REALM);

  world.structureManager.place(STARTER_ISLAND, dimension, ISLAND_ORIGIN);
  player.teleport(SKY_DOCK, { dimension });
  player.sendMessage(
    "§dExperimental sky realm§r — test reload, world copy, and multiplayer return paths.",
  );
}
