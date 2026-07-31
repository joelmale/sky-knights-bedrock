/**
 * Writes ambient island terrain from the field.
 *
 * Slice 3 of the procedural-island program: the executor that turns the fill
 * plan into blocks.
 *
 * Two properties make this simpler than the structure path it replaces.
 *
 * **Every write is air-only.** `fillBlocks` is given
 * `blockFilter: { includeTypes: ["minecraft:air"] }`, exactly as continent
 * terrain already is. Nothing this service writes can overwrite an existing
 * block, which is what simultaneously
 *   - lets overlapping islands merge into the union of their terrain instead of
 *     one erasing the other,
 *   - stops generation ever destroying a player's build, and
 *   - stops a later island cutting into an already-placed continent.
 * Whoever writes a block first keeps it.
 *
 * **Generation is idempotent.** A batch re-run writes nothing new, because the
 * blocks it would write are no longer air. That removes the whole defect class
 * the multipart structure cursor had, where a part could be marked done after a
 * `place()` that never landed and was then skipped forever. Here a resume can
 * safely replay from the beginning; the cursor is an optimisation, not a
 * correctness mechanism.
 */

import { BlockVolume, Dimension, system } from "@minecraft/server";

import { Logger } from "../diagnostics/logger";
import type { ArchipelagoFamily } from "./archipelago";
import { ContinentField } from "./continent-field";
import type { ContinentFillBand } from "./continent-chunk-plan";
import { IslandTerrainPlan, planIslandTerrain } from "./island-terrain-plan";

/**
 * Surface palettes per family.
 *
 * Mirrors the retiring authored catalogue so the four families stay visually
 * distinct once terrain comes from the field instead of from a structure.
 */
export const ISLAND_FAMILY_BLOCKS: Readonly<
  Record<ArchipelagoFamily, Readonly<Record<ContinentFillBand, string>>>
> = {
  verdant: {
    core: "minecraft:stone",
    subsurface: "minecraft:dirt",
    surface: "minecraft:grass_block",
    water: "minecraft:water",
  },
  desert: {
    core: "minecraft:sandstone",
    subsurface: "minecraft:red_sandstone",
    surface: "minecraft:smooth_sandstone",
    water: "minecraft:water",
  },
  tundra: {
    core: "minecraft:stone",
    subsurface: "minecraft:packed_ice",
    surface: "minecraft:snow_block",
    water: "minecraft:water",
  },
  volcanic: {
    core: "minecraft:blackstone",
    subsurface: "minecraft:basalt",
    surface: "minecraft:netherrack",
    water: "minecraft:water",
  },
};

export interface IslandTerrainResult {
  readonly batches: number;
  readonly volumes: number;
  readonly blocks: number;
  /** Fill calls that threw. Non-zero means the island is incomplete. */
  readonly failures: number;
}

/**
 * The minimal surface of `Dimension` this service uses.
 *
 * Declared so the executor is host-testable without Minecraft: the whole point
 * of the field is that terrain is knowable before a block is written, and the
 * write loop should be provable too.
 */
export interface IslandFillTarget {
  fillBlocks: Dimension["fillBlocks"];
}

/** Waits a tick. Injectable so tests do not depend on the engine scheduler. */
export type TickWaiter = (ticks: number) => Promise<void>;

const defaultWaiter: TickWaiter = async (ticks) => {
  await system.waitTicks(ticks);
};

/**
 * Writes one island's terrain, yielding between batches.
 *
 * A fill that throws is logged and counted rather than aborting the island: the
 * remaining batches are still worth writing, and because every write is
 * idempotent a later pass can complete whatever this one missed.
 */
export async function fillIslandTerrain(
  field: ContinentField,
  family: ArchipelagoFamily,
  dimension: IslandFillTarget,
  logger: Logger,
  options: {
    readonly plan?: IslandTerrainPlan;
    readonly waitTicks?: TickWaiter;
  } = {},
): Promise<IslandTerrainResult> {
  const plan = options.plan ?? planIslandTerrain(field);
  const wait = options.waitTicks ?? defaultWaiter;
  const palette = ISLAND_FAMILY_BLOCKS[family];
  let failures = 0;

  for (let index = 0; index < plan.batches.length; index += 1) {
    const batch = plan.batches[index];

    for (const volume of batch.volumes) {
      try {
        dimension.fillBlocks(
          new BlockVolume(volume.from, volume.to),
          palette[volume.band],
          { blockFilter: { includeTypes: ["minecraft:air"] } },
        );
      } catch (error) {
        failures += 1;
        logger.warn("Island terrain fill failed.", {
          error: error instanceof Error ? error.message : String(error),
          from: volume.from,
          to: volume.to,
        });
      }
    }

    if (index + 1 < plan.batches.length) {
      await wait(1);
    }
  }

  const padFailures = await levelDockPad(plan, family, dimension, logger);

  return {
    batches: plan.batches.length,
    volumes: plan.volumes,
    blocks: plan.blocks,
    failures: failures + padFailures,
  };
}

/**
 * Flattens the arrival pad.
 *
 * The authored islands had one constant surface height, so any dock anchor was
 * valid by accident. A real height field breaks that: without levelling, arrival
 * drops the player inside terrain or leaves them standing in air.
 *
 * This is the one place the service writes over non-air. The pad is a fixed
 * seven-by-seven square at the island centre, so the exception is bounded and
 * cannot spread; everything else stays strictly additive.
 */
async function levelDockPad(
  plan: IslandTerrainPlan,
  family: ArchipelagoFamily,
  dimension: IslandFillTarget,
  logger: Logger,
): Promise<number> {
  const surface = ISLAND_FAMILY_BLOCKS[family].surface;
  const pad = plan.dockPad;

  try {
    // Solid floor at the pad level, replacing whatever the field left.
    dimension.fillBlocks(new BlockVolume(pad.from, pad.to), surface);
  } catch (error) {
    logger.warn("Island dock pad floor failed.", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 1;
  }

  try {
    // Headroom above it, so arrival is never inside a hillside.
    dimension.fillBlocks(
      new BlockVolume(
        { x: pad.from.x, y: pad.from.y + 1, z: pad.from.z },
        { x: pad.to.x, y: pad.to.y + 3, z: pad.to.z },
      ),
      "minecraft:air",
    );
  } catch (error) {
    logger.warn("Island dock pad clearance failed.", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 1;
  }

  return 0;
}
