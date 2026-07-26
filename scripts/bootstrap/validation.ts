import { EntityTypes, ItemTypes, world } from "@minecraft/server";

import { IDENTIFIERS } from "../config/constants";
import { Logger } from "../diagnostics/logger";

export interface ValidationResult {
  ok: boolean;
  missing: string[];
}

export function validateRegistries(logger: Logger): ValidationResult {
  const missing: string[] = [];

  const requiredEntities = [
    IDENTIFIERS.skiff,
    IDENTIFIERS.skycutter,
    IDENTIFIERS.dockmaster,
  ];
  const requiredStructures = [
    IDENTIFIERS.starterIsland,
    IDENTIFIERS.emberOutpost,
    IDENTIFIERS.frostspire,
  ];
  const requiredItems = [
    IDENTIFIERS.shipCore,
    IDENTIFIERS.canvasBundle,
    IDENTIFIERS.thrusterModule,
    IDENTIFIERS.aetherCrystal,
    IDENTIFIERS.reinforcedHull,
    IDENTIFIERS.aetherEngine,
    IDENTIFIERS.cargoHold,
    IDENTIFIERS.navigatorModule,
    IDENTIFIERS.repairKit,
    IDENTIFIERS.froststeelIngot,
  ];

  for (const identifier of requiredEntities) {
    if (EntityTypes.get(identifier) === undefined) {
      missing.push(identifier);
    }
  }

  const structureIds = world.structureManager.getPackStructureIds();

  for (const identifier of requiredStructures) {
    if (!structureIds.includes(identifier)) {
      missing.push(identifier);
    }
  }

  for (const identifier of requiredItems) {
    if (ItemTypes.get(identifier) === undefined) {
      missing.push(identifier);
    }
  }

  if (missing.length > 0) {
    logger.error("Startup registry validation failed.", { missing });
    return { ok: false, missing };
  }

  logger.info("Startup registry validation passed.", {
    requiredIdentifiers: [
      ...requiredEntities,
      ...requiredStructures,
      ...requiredItems,
    ],
  });
  return { ok: true, missing };
}
