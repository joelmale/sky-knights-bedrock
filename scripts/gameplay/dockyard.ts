import {
  Container,
  Entity,
  EntityComponentTypes,
  EntityHealthComponent,
  EntityInventoryComponent,
  ItemStack,
  Player,
  system,
  world,
} from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

import {
  DOCKYARD,
  IDENTIFIERS,
  SKYCUTTER_LOADOUT,
  STARTER_ISLAND,
} from "../config/constants";
import { Logger } from "../diagnostics/logger";
import {
  PlayerStateRepository,
  WorldStateRepository,
} from "../persistence/repositories";
import {
  MaterialConsumption,
  countMaterials,
  planMaterialConsumption,
  shouldEnsureDockmaster,
} from "./dockyard-materials";
import { dockOwnedShip, isAtDock, resolveOwnedShip } from "./ship-docking";
import { isCompleteSkycutterLoadout } from "./ship-rules";
import {
  loadShipState,
  spawnSkiffForPlayer,
  spawnSkycutterForPlayer,
} from "./skiff";
import { objectiveText } from "./tutorial";

const ASSEMBLED_SKIFF_MODULES = {
  hull: "canvas_hull",
  engine: "starter_thruster",
} as const;

interface DockyardAction {
  label: string;
  execute: () => void | Promise<void>;
}

export function registerDockyardInteractions(logger: Logger): void {
  world.afterEvents.playerInteractWithEntity.subscribe(({ player, target }) => {
    if (target.typeId !== IDENTIFIERS.dockmaster) {
      return;
    }

    system.run(() => {
      void showDockyard(player, logger).catch((error: unknown) => {
        logger.error("Dockyard form failed.", {
          playerId: player.id,
          error: error instanceof Error ? error.message : String(error),
        });
        player.sendMessage(
          "§cThe shipyard could not complete that request. Check the Content Log.§r",
        );
      });
    });
  });
}

export function ensureDockmaster(
  repository: WorldStateRepository,
  logger: Logger,
): boolean {
  const dimension = world.getDimension(STARTER_ISLAND.dimensionId);
  const dockSupport = dimension.getBlock({
    x: Math.floor(DOCKYARD.dockmaster.x),
    y: Math.floor(DOCKYARD.dockmaster.y) - 1,
    z: Math.floor(DOCKYARD.dockmaster.z),
  });
  const islandRecorded = repository
    .load()
    .generatedIslandIds.includes(STARTER_ISLAND.id);

  if (!shouldEnsureDockmaster(islandRecorded, dockSupport?.typeId)) {
    return false;
  }

  const nearby = dimension.getEntities({
    type: IDENTIFIERS.dockmaster,
    location: DOCKYARD.dockmaster,
    maxDistance: 8,
  });

  if (nearby.length > 0) {
    return true;
  }

  const displaced = dimension.getEntities({
    type: IDENTIFIERS.dockmaster,
  })[0];

  if (displaced !== undefined) {
    displaced.teleport(DOCKYARD.dockmaster, { dimension });
    displaced.nameTag = "Dockmaster Elian";
    displaced.addTag("skyknights.dockmaster");
    logger.warn("Displaced Dockmaster returned to the starter dock.", {
      entityId: displaced.id,
    });
    return true;
  }

  const dockmaster = dimension.spawnEntity(
    IDENTIFIERS.dockmaster,
    DOCKYARD.dockmaster,
    { initialPersistence: true },
  );
  dockmaster.nameTag = "Dockmaster Elian";
  dockmaster.addTag("skyknights.dockmaster");
  logger.info("Dockmaster stationed at the starter dock.", {
    entityId: dockmaster.id,
  });
  return true;
}

async function showDockyard(player: Player, logger: Logger): Promise<void> {
  await resolveOwnedShip(player, true, logger);
  const playerRepository = new PlayerStateRepository(
    player,
    STARTER_ISLAND.safeDock,
  );
  const playerState = playerRepository.load();
  const container = playerInventory(player);
  const stacks = inventorySnapshot(container);
  const starterCounts = countMaterials(stacks, DOCKYARD.assemblyRequirements);
  const skycutterCounts = countMaterials(
    stacks,
    DOCKYARD.skycutterRequirements,
  );
  const actions: DockyardAction[] = [];

  if (!playerState.skycutterUnlocked) {
    actions.push({
      label: "Return Aether Crystal",
      execute: () => returnAetherCrystal(player, container, logger),
    });
  }

  if (playerState.ownedShip === undefined) {
    actions.push({
      label: "Assemble Starter Skiff",
      execute: () => assembleStarterSkiff(player, container, logger),
    });
  }

  if (
    playerState.skycutterUnlocked &&
    playerState.ownedShip?.frame !== "skycutter"
  ) {
    actions.push({
      label: "Assemble Skycutter",
      execute: () => assembleSkycutter(player, container, logger),
    });
  }

  if (
    playerState.skycutterUnlocked &&
    playerState.ownedShip?.frame !== "skycutter" &&
    countItem(container, IDENTIFIERS.aetherEngine) === 0
  ) {
    actions.push({
      label: "Replace Engine (1 Kit)",
      execute: () => replaceAetherEngine(player, container),
    });
  }

  if (playerState.ownedShip?.entityId !== undefined) {
    actions.push({
      label: "Recall / Dock Ship",
      execute: () => recallShip(player, logger),
    });
    actions.push({
      label: "Repair Docked Ship",
      execute: () => repairOwnedShip(player, container, logger),
    });
  }

  if (
    playerState.skycutterUnlocked &&
    playerState.ownedShip?.frame === "skycutter" &&
    playerState.ownedShip.entityId === undefined
  ) {
    actions.push({
      label: "Reconstruct Ship (1 Kit)",
      execute: () => reconstructSkycutter(player, container, logger),
    });
  }

  if (playerState.objective === "return_frost_cargo") {
    actions.push({
      label: "Deliver Froststeel",
      execute: () => deliverFroststeel(player, container, logger),
    });
  }

  actions.push({
    label: "Current Objective",
    execute: () => sendBriefing(player),
  });

  const starterRequirements = requirementText(
    DOCKYARD.assemblyRequirements,
    starterCounts,
  );
  const skycutterRequirements = requirementText(
    DOCKYARD.skycutterRequirements,
    skycutterCounts,
  );
  const body = [
    `Objective: ${objectiveText(playerState.objective)}`,
    "",
    `Owned ship: ${
      playerState.ownedShip === undefined
        ? "none"
        : `${displayFrame(playerState.ownedShip.frame)}${
            playerState.ownedShip.entityId === undefined
              ? " (needs reconstruction)"
              : ""
          }`
    }`,
    "",
    `Starter skiff:\n${starterRequirements}`,
    "",
    playerState.skycutterUnlocked
      ? `Skycutter slots:\n${skycutterRequirements}`
      : "Skycutter blueprint: locked until an Aether Crystal is returned.",
  ].join("\n");
  let form = new ActionFormData().title("Sky Knights Shipyard").body(body);

  for (const action of actions) {
    form = form.button(action.label);
  }

  const response = await form.show(player);

  if (response.canceled || response.selection === undefined) {
    return;
  }

  await actions[response.selection]?.execute();
}

function returnAetherCrystal(
  player: Player,
  container: Container,
  logger: Logger,
): void {
  const plan = planMaterialConsumption(inventorySnapshot(container), [
    { itemId: IDENTIFIERS.aetherCrystal, count: 1 },
  ]);

  if (plan === undefined) {
    player.sendMessage(
      "§cRecover the Aether Crystal from the Ember Outpost ruin first.§r",
    );
    return;
  }

  consumeMaterials(container, plan);
  const remainder = container.addItem(new ItemStack(IDENTIFIERS.aetherEngine));

  if (remainder !== undefined) {
    restoreMaterials(container, plan);
    throw new Error("Could not place the converted Aether Engine.");
  }

  const repository = new PlayerStateRepository(player, STARTER_ISLAND.safeDock);
  const state = repository.load();
  state.skycutterUnlocked = true;
  state.objective = "assemble_skycutter";
  repository.save(state);
  player.sendMessage(
    "§aDockmaster Elian converted the crystal into an Aether Engine and unlocked the Skycutter blueprint.§r",
  );
  player.sendMessage(
    "Craft a Reinforced Hull, Cargo Hold, and Navigator Module, then return to the shipyard.",
  );
  logger.info("Skycutter blueprint unlocked.", { playerId: player.id });
}

function assembleStarterSkiff(
  player: Player,
  container: Container,
  logger: Logger,
): void {
  const dimension = world.getDimension(STARTER_ISLAND.dimensionId);
  const blockedLaunch = dimension.getEntities({
    location: DOCKYARD.skiffLaunch,
    maxDistance: 5,
    tags: ["skyknights.ship"],
  });

  if (blockedLaunch.length > 0) {
    player.sendMessage(
      "§eThe launch berth is occupied. Recall or move the existing ship first.§r",
    );
    return;
  }

  const playerRepository = new PlayerStateRepository(
    player,
    STARTER_ISLAND.safeDock,
  );

  if (playerRepository.load().ownedShip !== undefined) {
    player.sendMessage(
      "§eYou already have an owned ship. Use Recall / Dock Ship instead.§r",
    );
    return;
  }

  const plan = planMaterialConsumption(
    inventorySnapshot(container),
    DOCKYARD.assemblyRequirements,
  );

  if (plan === undefined) {
    player.sendMessage(
      "§cYou need one Ship Core, two Canvas Bundles, and one Thruster Module.§r",
    );
    return;
  }

  consumeMaterials(container, plan);

  try {
    spawnSkiffForPlayer(
      player,
      logger.child("skiff-assembly"),
      DOCKYARD.skiffLaunch,
      ASSEMBLED_SKIFF_MODULES,
    );
  } catch (error) {
    restoreMaterials(container, plan);
    throw error;
  }

  const state = playerRepository.load();
  state.objective = "recover_aether_crystal";
  playerRepository.save(state);
  player.sendMessage(
    "§aStarter skiff assembled. Fly east to the Ember Outpost near X=84, Z=0.§r",
  );
}

async function assembleSkycutter(
  player: Player,
  container: Container,
  logger: Logger,
): Promise<void> {
  const playerRepository = new PlayerStateRepository(
    player,
    STARTER_ISLAND.safeDock,
  );
  const playerState = playerRepository.load();

  if (!playerState.skycutterUnlocked) {
    player.sendMessage("§cReturn the Aether Crystal first.§r");
    return;
  }

  const existingShip = await resolveOwnedShip(player, true, logger);
  const existingState =
    existingShip === undefined ? undefined : loadShipState(existingShip);

  if (existingState?.configuration.frame === "skycutter") {
    player.sendMessage("§eYou already own a Skycutter.§r");
    return;
  }

  const dimension = world.getDimension(STARTER_ISLAND.dimensionId);
  const berthShips = dimension.getEntities({
    location: DOCKYARD.skycutterLaunch,
    maxDistance: 6,
    tags: ["skyknights.ship"],
  });

  if (
    berthShips.some(
      (ship) => existingShip === undefined || ship.id !== existingShip.id,
    )
  ) {
    player.sendMessage(
      "§eThe Skycutter berth is occupied. Move the other ship first.§r",
    );
    return;
  }

  const plan = planMaterialConsumption(
    inventorySnapshot(container),
    DOCKYARD.skycutterRequirements,
  );

  if (plan === undefined) {
    player.sendMessage(
      "§cFill all four slots: Reinforced Hull, Aether Engine, Cargo Hold, and Navigator Module.§r",
    );
    return;
  }

  consumeMaterials(container, plan);

  try {
    spawnSkycutterForPlayer(
      player,
      logger.child("skycutter-assembly"),
      DOCKYARD.skycutterLaunch,
      SKYCUTTER_LOADOUT,
    );
  } catch (error) {
    restoreMaterials(container, plan);
    throw error;
  }

  if (existingShip?.isValid) {
    existingShip.remove();
  }

  const state = playerRepository.load();
  state.objective = "reach_frostspire";
  playerRepository.save(state);
  player.sendMessage(
    "§aSkycutter assembled with Hull, Engine, Cargo, and Navigator modules.§r",
  );
  player.sendMessage(
    "The Aether Engine can cross the old range boundary. Frostspire lies near X=253, Z=0.",
  );
  player.sendMessage(
    "Crouch-interact with the Skycutter to access its 18-slot cargo hold.",
  );
}

function replaceAetherEngine(player: Player, container: Container): void {
  if (!consumeOne(container, IDENTIFIERS.repairKit)) {
    player.sendMessage("§cOne Repair Kit is required.§r");
    return;
  }

  const remainder = container.addItem(new ItemStack(IDENTIFIERS.aetherEngine));

  if (remainder !== undefined) {
    container.addItem(new ItemStack(IDENTIFIERS.repairKit));
    throw new Error("Could not issue the replacement Aether Engine.");
  }

  player.sendMessage("§aReplacement Aether Engine issued.§r");
}

async function recallShip(player: Player, logger: Logger): Promise<void> {
  const ship = await dockOwnedShip(player, logger);

  if (ship === undefined) {
    player.sendMessage(
      "§eThe ship was not found at its saved location. Use reconstruction if it was destroyed.§r",
    );
    return;
  }

  player.sendMessage("§aOwned ship recalled and secured at the home dock.§r");
}

async function repairOwnedShip(
  player: Player,
  container: Container,
  logger: Logger,
): Promise<void> {
  const ship = await resolveOwnedShip(player, false, logger);

  if (ship === undefined || !isAtDock(ship)) {
    player.sendMessage("§eRecall or land the owned ship at the dock first.§r");
    return;
  }

  const health = ship.getComponent(EntityComponentTypes.Health) as
    EntityHealthComponent | undefined;

  if (health === undefined) {
    throw new Error("Owned ship has no health component.");
  }

  if (health.currentValue >= health.effectiveMax) {
    player.sendMessage("§aThe ship is already at full hull integrity.§r");
    return;
  }

  if (!consumeOne(container, IDENTIFIERS.repairKit)) {
    player.sendMessage("§cOne Repair Kit is required for a full repair.§r");
    return;
  }

  health.resetToMaxValue();
  player.sendMessage(
    `§aShip repaired to ${Math.ceil(health.effectiveMax)} hull integrity.§r`,
  );
}

async function reconstructSkycutter(
  player: Player,
  container: Container,
  logger: Logger,
): Promise<void> {
  const existing = await resolveOwnedShip(player, true, logger);

  if (existing !== undefined) {
    player.sendMessage(
      "§eThe original ship still exists. Use Recall / Dock Ship instead.§r",
    );
    return;
  }

  const repository = new PlayerStateRepository(player, STARTER_ISLAND.safeDock);
  const state = repository.load();
  const modules =
    state.ownedShip?.modules !== undefined &&
    isCompleteSkycutterLoadout(state.ownedShip.modules)
      ? state.ownedShip.modules
      : SKYCUTTER_LOADOUT;

  if (!consumeOne(container, IDENTIFIERS.repairKit)) {
    player.sendMessage("§cOne Repair Kit is required for reconstruction.§r");
    return;
  }

  try {
    spawnSkycutterForPlayer(
      player,
      logger.child("reconstruction"),
      DOCKYARD.skycutterLaunch,
      modules,
    );
  } catch (error) {
    container.addItem(new ItemStack(IDENTIFIERS.repairKit));
    throw error;
  }

  player.sendMessage(
    "§aThe Skycutter was reconstructed from its saved blueprint. Lost cargo was not recoverable.§r",
  );
}

async function deliverFroststeel(
  player: Player,
  playerContainer: Container,
  logger: Logger,
): Promise<void> {
  let delivered = consumeOne(playerContainer, IDENTIFIERS.froststeelIngot);

  if (!delivered) {
    const ship = await resolveOwnedShip(player, false, logger);

    if (ship !== undefined && isAtDock(ship)) {
      const inventory = ship.getComponent(EntityComponentTypes.Inventory) as
        EntityInventoryComponent | undefined;

      if (inventory?.container !== undefined) {
        delivered = consumeOne(
          inventory.container,
          IDENTIFIERS.froststeelIngot,
        );
      }
    }
  }

  if (!delivered) {
    player.sendMessage(
      "§cBring one Froststeel Ingot in your inventory or in a docked Skycutter cargo hold.§r",
    );
    return;
  }

  const repository = new PlayerStateRepository(player, STARTER_ISLAND.safeDock);
  const state = repository.load();
  state.objective = "complete";
  repository.save(state);
  playerContainer.addItem(new ItemStack(IDENTIFIERS.repairKit, 2));
  player.sendMessage(
    "§bCrystal-to-Cutter expedition complete. Dockmaster Elian awarded two Repair Kits.§r",
  );
}

function sendBriefing(player: Player): void {
  const state = new PlayerStateRepository(
    player,
    STARTER_ISLAND.safeDock,
  ).load();
  player.sendMessage(`§6Dockmaster Elian:§r ${objectiveText(state.objective)}`);

  if (state.objective === "reach_frostspire") {
    player.sendMessage(
      "Frostspire is east near X=253, Z=0. A starter skiff is repelled before reaching it.",
    );
  }
}

function playerInventory(player: Player): Container {
  const inventory = player.getComponent(EntityComponentTypes.Inventory) as
    EntityInventoryComponent | undefined;

  if (inventory?.container === undefined) {
    throw new Error(`Player ${player.id} has no inventory container.`);
  }

  return inventory.container;
}

function inventorySnapshot(container: Container): Array<ItemStack | undefined> {
  return Array.from({ length: container.size }, (_, slot) =>
    container.getItem(slot),
  );
}

function consumeOne(container: Container, itemId: string): boolean {
  const plan = planMaterialConsumption(inventorySnapshot(container), [
    { itemId, count: 1 },
  ]);

  if (plan === undefined) {
    return false;
  }

  consumeMaterials(container, plan);
  return true;
}

function consumeMaterials(
  container: Container,
  plan: readonly MaterialConsumption[],
): void {
  for (const operation of plan) {
    const stack = container.getItem(operation.slot);

    if (
      stack === undefined ||
      stack.typeId !== operation.itemId ||
      stack.amount < operation.count
    ) {
      throw new Error("Inventory changed during dockyard transaction.");
    }

    if (stack.amount === operation.count) {
      container.setItem(operation.slot);
    } else {
      stack.amount -= operation.count;
      container.setItem(operation.slot, stack);
    }
  }
}

function restoreMaterials(
  container: Container,
  plan: readonly MaterialConsumption[],
): void {
  for (const operation of plan) {
    const remainder = container.addItem(
      new ItemStack(operation.itemId, operation.count),
    );

    if (remainder !== undefined) {
      throw new Error(
        `Could not restore ${remainder.amount} ${operation.itemId}.`,
      );
    }
  }
}

function requirementText(
  requirements: readonly { itemId: string; count: number }[],
  counts: Readonly<Record<string, number>>,
): string {
  return requirements
    .map(
      ({ itemId, count }) =>
        `${displayItem(itemId)}: ${counts[itemId] ?? 0}/${count}`,
    )
    .join("\n");
}

function countItem(container: Container, itemId: string): number {
  let count = 0;

  for (let slot = 0; slot < container.size; slot += 1) {
    const stack = container.getItem(slot);

    if (stack?.typeId === itemId) {
      count += stack.amount;
    }
  }

  return count;
}

function displayFrame(frame: "skiff" | "skycutter"): string {
  return frame === "skycutter" ? "Skycutter" : "Starter Skiff";
}

function displayItem(itemId: string): string {
  const names: Record<string, string> = {
    [IDENTIFIERS.shipCore]: "Ship Core",
    [IDENTIFIERS.canvasBundle]: "Canvas Bundle",
    [IDENTIFIERS.thrusterModule]: "Thruster Module",
    [IDENTIFIERS.reinforcedHull]: "Hull slot",
    [IDENTIFIERS.aetherEngine]: "Engine slot",
    [IDENTIFIERS.cargoHold]: "Cargo slot",
    [IDENTIFIERS.navigatorModule]: "Utility slot",
  };
  return names[itemId] ?? itemId;
}
