import { world } from "@minecraft/server";
import type { Vector3 } from "@minecraft/server";

import { Logger } from "../diagnostics/logger";
import { WorldStateRepository } from "../persistence/repositories";
import { markIslandPlayerModified } from "../persistence/schema";
import { islandLayoutRecordAtBlock } from "./discovery";

/**
 * Makes the schema-5 `playerModified` protection real. Once a player places or
 * breaks a block inside a persisted island structure, automatic content
 * upgrades may no longer stamp that island again.
 */
export function registerIslandModificationTracking(
  repository: WorldStateRepository,
  logger: Logger,
): void {
  const markModified = (dimensionId: string, location: Vector3): void => {
    try {
      const state = repository.load();
      const island = islandLayoutRecordAtBlock(state, dimensionId, location);

      if (island === undefined) {
        return;
      }

      const next = markIslandPlayerModified(state, island.id);

      if (next === state) {
        return;
      }

      repository.save(next);
      logger.info("Island marked as player-modified.", {
        islandId: island.id,
      });
    } catch (error) {
      logger.warn("Could not record an island block modification.", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  world.afterEvents.playerBreakBlock.subscribe(({ block, dimension }) => {
    markModified(dimension.id, block.location);
  });
  world.afterEvents.playerPlaceBlock.subscribe(({ block, dimension }) => {
    markModified(dimension.id, block.location);
  });
}
