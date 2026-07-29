import { BlockTypes, EntityTypes, ItemTypes, world } from "@minecraft/server";

import { IDENTIFIERS } from "../config/constants";
import { shippedIslandStructureIds } from "../config/islands";
import { Logger } from "../diagnostics/logger";
import { ARCHIPELAGO_STRUCTURE_IDS } from "../generation/archipelago";
import { ARCHIPELAGO_V3_STRUCTURE_IDS } from "../generation/archipelago-v3";
import { SKYCRAFT_COMPONENT_IDS, SKYCRAFT_IDS } from "../skycraft/config";

export interface ValidationResult {
  ok: boolean;
  missing: string[];
}

export function validateRegistries(logger: Logger): ValidationResult {
  const missing: string[] = [];

  const requiredEntities = [
    IDENTIFIERS.skiff,
    IDENTIFIERS.skycutter,
    IDENTIFIERS.aetherOutrigger,
    IDENTIFIERS.steampunkBlimp,
    IDENTIFIERS.dockmaster,
    IDENTIFIERS.skyRaider,
    SKYCRAFT_IDS.flightEntity,
  ];
  // Structure-only Phase 3 islands must still have their packaged structure;
  // that validation is intentionally independent from gameplay activation.
  const requiredStructures = [
    ...shippedIslandStructureIds(),
    ...ARCHIPELAGO_STRUCTURE_IDS,
    ...ARCHIPELAGO_V3_STRUCTURE_IDS,
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
    IDENTIFIERS.armoredHull,
    IDENTIFIERS.frostfireEngine,
    IDENTIFIERS.expandedCargoHold,
    IDENTIFIERS.aetherCannon,
    IDENTIFIERS.shieldProjector,
    IDENTIFIERS.cannonControl,
    IDENTIFIERS.aetherCharge,
    IDENTIFIERS.raiderCore,
    IDENTIFIERS.relicShard,
    IDENTIFIERS.aetherCore,
  ];
  const requiredBlocks = [...SKYCRAFT_COMPONENT_IDS];

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

  for (const identifier of requiredBlocks) {
    if (BlockTypes.get(identifier) === undefined) {
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
      ...requiredBlocks,
    ],
  });
  return { ok: true, missing };
}
