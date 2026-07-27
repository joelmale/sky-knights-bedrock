import { fnv1a32 } from "../util/hash";

export type ArchipelagoFamily = "verdant" | "desert" | "tundra" | "volcanic";

export interface ArchipelagoIsland {
  id: string;
  family: ArchipelagoFamily;
  cellX: number;
  cellZ: number;
  /** Horizontal center of the island structure. */
  x: number;
  /** Bottom of the island structure. */
  y: number;
  /** Horizontal center of the island structure. */
  z: number;
  radius: number;
}

export interface ArchipelagoCluster {
  family: ArchipelagoFamily;
  cellX: number;
  cellZ: number;
}

export interface ArchipelagoTemplate {
  structureId: string;
  size: { x: number; y: number; z: number };
  integrityBlocks: readonly {
    offset: { x: number; y: number; z: number };
    typeId: string;
  }[];
}

export const ARCHIPELAGO_CONFIG = {
  idVersion: 1,
  /** Finite planning envelope: 57 x 57 possible cells. */
  maxCellRadius: 28,
  /** Protects every authored progression island and its travel lanes. */
  protectedRadius: 460,
  cellSize: 96,
  minSpacing: 48,
  maxQueryRadius: 512,
  /** Never stamp a new island directly under or around an active player. */
  minObserverDistance: 48,
  /** Persistence/performance gate; the plan contains more possible islands. */
  maxGeneratedIslands: 384,
  /** One in every three eligible cells contains an island. */
  generationDensity: 3,
  minY: 145,
  maxY: 163,
  conservativeTemplateRadius: 19,
} as const;

const TEMPLATE_SIZE = { x: 15, y: 10, z: 13 } as const;
const TEMPLATE_PROBES = [
  { x: 7, y: 0, z: 6, role: "core" },
  { x: 1, y: 5, z: 6, role: "surface" },
  { x: 13, y: 5, z: 6, role: "surface" },
  { x: 7, y: 5, z: 1, role: "surface" },
  { x: 7, y: 5, z: 11, role: "surface" },
] as const;
const TEMPLATE_PALETTES: Readonly<
  Record<ArchipelagoFamily, { core: string; surface: string }>
> = {
  verdant: {
    core: "minecraft:stone",
    surface: "minecraft:grass_block",
  },
  desert: {
    core: "minecraft:sandstone",
    surface: "minecraft:red_sand",
  },
  tundra: {
    core: "minecraft:stone",
    surface: "minecraft:snow_block",
  },
  volcanic: {
    core: "minecraft:blackstone",
    surface: "minecraft:netherrack",
  },
};

const FAMILIES: readonly ArchipelagoFamily[] = [
  "verdant",
  "desert",
  "tundra",
  "volcanic",
];
const ID_PATTERN = /^a1_([np]\d+)_([np]\d+)$/u;

function templateFor(family: ArchipelagoFamily): ArchipelagoTemplate {
  const palette = TEMPLATE_PALETTES[family];

  return {
    structureId: `skyknights:ambient_${family}`,
    size: TEMPLATE_SIZE,
    integrityBlocks: TEMPLATE_PROBES.map((probe) => ({
      offset: { x: probe.x, y: probe.y, z: probe.z },
      typeId: palette[probe.role],
    })),
  };
}

export const ARCHIPELAGO_TEMPLATES: Readonly<
  Record<ArchipelagoFamily, ArchipelagoTemplate>
> = {
  verdant: templateFor("verdant"),
  desert: templateFor("desert"),
  tundra: templateFor("tundra"),
  volcanic: templateFor("volcanic"),
};

export const ARCHIPELAGO_STRUCTURE_IDS: readonly string[] = FAMILIES.map(
  (family) => ARCHIPELAGO_TEMPLATES[family].structureId,
);

function hash(values: readonly (string | number)[]): number {
  return fnv1a32(values.map(String).join("\0")) >>> 0;
}

function clusterPlan(
  worldSeed: number,
  layoutVersion: number,
): readonly ArchipelagoCluster[] {
  const radius = Math.floor(ARCHIPELAGO_CONFIG.maxCellRadius * 0.62);
  const bases = [
    { cellX: -radius, cellZ: -radius },
    { cellX: radius, cellZ: -radius },
    { cellX: -radius, cellZ: radius },
    { cellX: radius, cellZ: radius },
  ] as const;

  return FAMILIES.map((family, index) => {
    const random = hash([worldSeed >>> 0, layoutVersion, family, "cluster"]);

    return {
      family,
      cellX: bases[index].cellX + (random % 5) - 2,
      cellZ: bases[index].cellZ + (Math.floor(random / 5) % 5) - 2,
    };
  });
}

function familyFor(
  worldSeed: number,
  layoutVersion: number,
  cellX: number,
  cellZ: number,
): ArchipelagoFamily {
  let selected = clusterPlan(worldSeed, layoutVersion)[0];
  let selectedDistance = Number.POSITIVE_INFINITY;

  for (const cluster of clusterPlan(worldSeed, layoutVersion)) {
    const distance =
      Math.abs(cellX - cluster.cellX) + Math.abs(cellZ - cluster.cellZ);

    if (distance < selectedDistance) {
      selected = cluster;
      selectedDistance = distance;
    }
  }

  return selected.family;
}

function encodeCoordinate(value: number): string {
  return `${value < 0 ? "n" : "p"}${Math.abs(value)}`;
}

function decodeCoordinate(value: string): number | undefined {
  const magnitude = Number(value.slice(1));

  if (!Number.isSafeInteger(magnitude)) {
    return undefined;
  }

  return value.startsWith("n") ? -magnitude : magnitude;
}

function idFor(cellX: number, cellZ: number): string {
  return `a1_${encodeCoordinate(cellX)}_${encodeCoordinate(cellZ)}`;
}

function compareId(left: ArchipelagoIsland, right: ArchipelagoIsland): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function validCell(cellX: number, cellZ: number): boolean {
  const cellRadius = Math.max(Math.abs(cellX), Math.abs(cellZ));

  if (cellRadius === 0 || cellRadius > ARCHIPELAGO_CONFIG.maxCellRadius) {
    return false;
  }

  const x = cellX * ARCHIPELAGO_CONFIG.cellSize;
  const z = cellZ * ARCHIPELAGO_CONFIG.cellSize;

  return (
    x * x + z * z >=
    ARCHIPELAGO_CONFIG.protectedRadius * ARCHIPELAGO_CONFIG.protectedRadius
  );
}

export function deriveArchipelagoIsland(
  worldSeed: number,
  layoutVersion: number,
  cellX: number,
  cellZ: number,
): ArchipelagoIsland | undefined {
  if (!validCell(cellX, cellZ)) {
    return undefined;
  }

  const roll = hash([worldSeed >>> 0, layoutVersion, cellX, cellZ, "present"]);

  if (roll % ARCHIPELAGO_CONFIG.generationDensity !== 0) {
    return undefined;
  }

  const altitude =
    ARCHIPELAGO_CONFIG.minY +
    (hash([worldSeed >>> 0, layoutVersion, cellX, cellZ, "height"]) %
      (ARCHIPELAGO_CONFIG.maxY - ARCHIPELAGO_CONFIG.minY + 1));

  return {
    id: idFor(cellX, cellZ),
    family: familyFor(worldSeed, layoutVersion, cellX, cellZ),
    cellX,
    cellZ,
    x: cellX * ARCHIPELAGO_CONFIG.cellSize,
    y: altitude,
    z: cellZ * ARCHIPELAGO_CONFIG.cellSize,
    radius: ARCHIPELAGO_CONFIG.conservativeTemplateRadius,
  };
}

/**
 * Materializes the bounded planning envelope for tooling/tests. Runtime code
 * should query nearby cells instead of iterating this complete array.
 */
export function planArchipelago(
  worldSeed: number,
  layoutVersion: number,
): readonly ArchipelagoIsland[] {
  const result: ArchipelagoIsland[] = [];

  for (
    let cellX = -ARCHIPELAGO_CONFIG.maxCellRadius;
    cellX <= ARCHIPELAGO_CONFIG.maxCellRadius;
    cellX += 1
  ) {
    for (
      let cellZ = -ARCHIPELAGO_CONFIG.maxCellRadius;
      cellZ <= ARCHIPELAGO_CONFIG.maxCellRadius;
      cellZ += 1
    ) {
      const island = deriveArchipelagoIsland(
        worldSeed,
        layoutVersion,
        cellX,
        cellZ,
      );

      if (island !== undefined) {
        result.push(island);
      }
    }
  }

  return result.sort(compareId);
}

export function parseArchipelagoIslandId(
  worldSeed: number,
  layoutVersion: number,
  id: string,
): ArchipelagoIsland | undefined {
  const match = ID_PATTERN.exec(id);

  if (match === null) {
    return undefined;
  }

  const cellX = decodeCoordinate(match[1]);
  const cellZ = decodeCoordinate(match[2]);

  if (cellX === undefined || cellZ === undefined) {
    return undefined;
  }

  const island = deriveArchipelagoIsland(
    worldSeed,
    layoutVersion,
    cellX,
    cellZ,
  );

  return island?.id === id ? island : undefined;
}

export function archipelagoIslandsWithinRadius(
  worldSeed: number,
  layoutVersion: number,
  x: number,
  z: number,
  requestedRadius: number,
): readonly ArchipelagoIsland[] {
  if (!Number.isFinite(requestedRadius) || requestedRadius < 0) {
    return [];
  }

  const radius = Math.min(
    Math.trunc(requestedRadius),
    ARCHIPELAGO_CONFIG.maxQueryRadius,
  );
  const cellRadius = Math.ceil(radius / ARCHIPELAGO_CONFIG.cellSize) + 1;
  const centerX = Math.round(x / ARCHIPELAGO_CONFIG.cellSize);
  const centerZ = Math.round(z / ARCHIPELAGO_CONFIG.cellSize);
  const result: ArchipelagoIsland[] = [];

  for (
    let cellX = centerX - cellRadius;
    cellX <= centerX + cellRadius;
    cellX += 1
  ) {
    for (
      let cellZ = centerZ - cellRadius;
      cellZ <= centerZ + cellRadius;
      cellZ += 1
    ) {
      const island = deriveArchipelagoIsland(
        worldSeed,
        layoutVersion,
        cellX,
        cellZ,
      );

      if (island === undefined) {
        continue;
      }

      const dx = island.x - x;
      const dz = island.z - z;

      if (dx * dx + dz * dz <= radius * radius) {
        result.push(island);
      }
    }
  }

  return result.sort(compareId);
}

export function archipelagoClusters(
  worldSeed: number,
  layoutVersion: number,
): readonly ArchipelagoCluster[] {
  return clusterPlan(worldSeed, layoutVersion);
}
