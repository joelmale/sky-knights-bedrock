import { system, world } from "@minecraft/server";

const LOG_PREFIX = "[Sky Knights]";

system.run(() => {
  console.warn(
    `${LOG_PREFIX} behavior pack loaded at tick ${system.currentTick}.`,
  );
});

world.afterEvents.playerSpawn.subscribe(({ initialSpawn, player }) => {
  if (!initialSpawn) {
    return;
  }

  player.sendMessage("§bSky Knights§r development pack is active.");
});
