import { describe, expect, it } from "vitest";

// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as isletDesert } from "../tools/structures/islet_desert.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as isletTundra } from "../tools/structures/islet_tundra.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as isletVerdant } from "../tools/structures/islet_verdant.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as isletVolcanic } from "../tools/structures/islet_volcanic.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as cragDesert } from "../tools/structures/crag_desert.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as cragTundra } from "../tools/structures/crag_tundra.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as cragVerdant } from "../tools/structures/crag_verdant.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as cragVolcanic } from "../tools/structures/crag_volcanic.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as cragVolcanicEmber } from "../tools/structures/crag_volcanic_ember.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as landmarkDesert } from "../tools/structures/landmark_desert.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as landmarkTundra } from "../tools/structures/landmark_tundra.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as landmarkVerdant } from "../tools/structures/landmark_verdant.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as landmarkVolcanic } from "../tools/structures/landmark_volcanic.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as landmarkVolcanicEmber } from "../tools/structures/landmark_volcanic_ember.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as landmarkVolcanicPyre } from "../tools/structures/landmark_volcanic_pyre.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as compBridge } from "../tools/structures/comp_bridge.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as compChasm } from "../tools/structures/comp_chasm.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as compCoast } from "../tools/structures/comp_coast.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as compLake } from "../tools/structures/comp_lake.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as compPlain } from "../tools/structures/comp_plain.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as compRidge } from "../tools/structures/comp_ridge.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as duoMesa } from "../tools/structures/duo_mesa.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import * as assertions from "../tools/structures/assert.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { zyxIndex } from "../tools/structures/nbt.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { assertSeamShell } from "../tools/structures/continent_shared.mjs";

interface Body {
  contains(x: number, y: number, z: number): boolean;
}

interface Counts {
  void: number;
  air: number;
  solid: number;
  liquid: number;
  total: number;
}

interface Inspection {
  indices: number[];
  counts: Counts;
  budget: Budget;
}

interface Budget {
  boxCells: number;
  maxSolid: number;
  maxAir: number;
  maxLiquid: number;
  occupancy?: number;
  voidFloor?: number;
}

interface Structure {
  id: string;
  tier: string;
  family: string;
  role?: string;
  structureId: string;
  size: number[];
  palette: string[];
  body?: Body;
  bridgeAbutments?: string[];
  coastFaces?: string[];
  inspect(): Inspection;
  build(): Uint8Array;
}

const SOLO = [
  isletDesert,
  isletTundra,
  isletVerdant,
  isletVolcanic,
  cragDesert,
  cragTundra,
  cragVerdant,
  cragVolcanic,
  cragVolcanicEmber,
  landmarkDesert,
  landmarkTundra,
  landmarkVerdant,
  landmarkVolcanic,
  landmarkVolcanicEmber,
  landmarkVolcanicPyre,
] as Structure[];

const COMPONENTS = [
  compBridge,
  compChasm,
  compCoast,
  compLake,
  compPlain,
  compRidge,
  duoMesa,
] as Structure[];

const ALL = [...SOLO, ...COMPONENTS];

const EXPECTED = [
  ["islet_desert", "islet", "desert"],
  ["islet_tundra", "islet", "tundra"],
  ["islet_verdant", "islet", "verdant"],
  ["islet_volcanic", "islet", "volcanic"],
  ["crag_desert", "crag", "desert"],
  ["crag_tundra", "crag", "tundra"],
  ["crag_verdant", "crag", "verdant"],
  ["crag_volcanic", "crag", "volcanic"],
  ["crag_volcanic_ember", "crag", "volcanic"],
  ["landmark_desert", "landmark", "desert"],
  ["landmark_tundra", "landmark", "tundra"],
  ["landmark_verdant", "landmark", "verdant"],
  ["landmark_volcanic", "landmark", "volcanic"],
  ["landmark_volcanic_ember", "landmark", "volcanic"],
  ["landmark_volcanic_pyre", "landmark", "volcanic"],
  ["comp_bridge", "continent", "continent"],
  ["comp_chasm", "continent", "continent"],
  ["comp_coast", "continent", "continent"],
  ["comp_lake", "continent", "continent"],
  ["comp_plain", "continent", "continent"],
  ["comp_ridge", "continent", "continent"],
  ["duo_mesa", "continent", "continent"],
];

function assertBudget(structure: Structure): void {
  const { counts, budget } = structure.inspect();

  expect(counts.total).toBe(budget.boxCells);
  expect(counts.solid).toBeLessThanOrEqual(budget.maxSolid);
  expect(counts.air).toBeLessThanOrEqual(budget.maxAir);
  expect(counts.liquid).toBeLessThanOrEqual(budget.maxLiquid);
  expect(counts.solid + counts.air + counts.liquid).toBeLessThanOrEqual(
    budget.occupancy ?? Number.MAX_SAFE_INTEGER,
  );
  expect(counts.void).toBeGreaterThanOrEqual(
    Math.ceil(budget.boxCells * (budget.voidFloor ?? 0)),
  );
}

describe("archipelago variety structure contracts", () => {
  it("exports every approved module with a unique, stable identity", () => {
    expect(ALL).toHaveLength(EXPECTED.length);
    expect(new Set(ALL.map((structure) => structure.id)).size).toBe(ALL.length);
    expect(new Set(ALL.map((structure) => structure.structureId)).size).toBe(
      ALL.length,
    );

    for (const [id, tier, family] of EXPECTED) {
      const structure = ALL.find((candidate) => candidate.id === id);

      expect(structure).toBeDefined();
      expect(structure?.tier).toBe(tier);
      expect(structure?.family).toBe(family);
      expect(structure?.structureId).toBe(`skyknights:${id}`);
    }
  });

  it("keeps every new structure within its complete cell budget", () => {
    for (const structure of ALL) {
      assertBudget(structure);
      expect(structure.palette[structure.palette.length - 1]).toBe(
        "minecraft:air",
      );
    }
  });

  it("keeps solo body cells non-void and produces deterministic buffers", () => {
    for (const structure of SOLO) {
      const inspection = structure.inspect();
      const body = structure.body;

      expect(body, `${structure.id} must expose its silhouette`).toBeDefined();
      const [width, height, depth] = structure.size;

      for (let x = 0; x < width; x += 1) {
        for (let y = 0; y < height; y += 1) {
          for (let z = 0; z < depth; z += 1) {
            const index = inspection.indices[zyxIndex(structure.size, x, y, z)];

            if (body?.contains(x, y, z)) {
              expect(
                index,
                `${structure.id} leaked structure void into its declared body at ${x},${y},${z}`,
              ).not.toBe(-1);
            }
          }
        }
      }

      expect(structure.build()).toEqual(structure.build());
    }
  }, 10_000);

  it("keeps burning variants bounded and protected by live guards", () => {
    const emberVariants = [
      cragVolcanicEmber,
      landmarkVolcanicEmber,
    ] as Structure[];

    for (const structure of emberVariants) {
      const inspection = structure.inspect();
      const fireIndex = structure.palette.indexOf("minecraft:fire");

      expect(fireIndex).toBeGreaterThanOrEqual(0);
      expect(inspection.counts.liquid).toBeGreaterThan(0);
      expect(inspection.counts.liquid).toBeLessThanOrEqual(
        structure.tier === "crag" ? 30 : 60,
      );
      expect(() =>
        assertions.assertFireSafety({
          name: structure.id,
          size: structure.size,
          indices: inspection.indices,
          fireIndex,
          flammableIndices: [
            structure.palette.indexOf("minecraft:oak_log"),
            structure.palette.indexOf("minecraft:oak_leaves"),
          ],
        }),
      ).not.toThrow();
    }

    const pyre = landmarkVolcanicPyre as Structure;
    const pyreInspection = pyre.inspect();
    expect(pyre.palette).not.toContain("minecraft:fire");
    expect(pyre.palette).not.toContain("minecraft:netherrack");
    expect(pyreInspection.counts.liquid).toBe(2);
    expect(pyreInspection.counts.solid).toBeLessThanOrEqual(8_500);

    expect(() =>
      assertions.assertFireSafety({
        name: "bad-fire-ring",
        size: [3, 3, 3],
        indices: [1, ...Array(25).fill(-1), 0],
        fireIndex: 1,
        flammableIndices: [0],
      }),
    ).toThrow(/safety ring/u);
    expect(() =>
      assertions.assertPyreTermination({
        name: "bad-pyre",
        size: [3, 3, 3],
        indices: Array(27).fill(-1),
        flammableIndices: [0],
        lavaIndex: 1,
        linerIndices: [2],
        zone: { minX: 0, maxX: 2, minY: 0, maxY: 2, minZ: 0, maxZ: 2 },
        fuelBudget: 0,
        airIndex: 3,
        palette: [
          "minecraft:stone",
          "minecraft:lava",
          "minecraft:stone",
          "minecraft:air",
        ],
      }),
    ).toThrow(/exactly 2 sealed lava cells/u);
  });

  it("preserves frozen continent seams and per-part placement limits", () => {
    for (const component of COMPONENTS) {
      const inspection = component.inspect();

      assertBudget(component);
      expect(() =>
        assertSeamShell({
          name: component.id,
          indices: inspection.indices,
          edgeRole: "interior",
          coastFaces: component.coastFaces ?? [],
          bridgeAbutments: component.bridgeAbutments ?? [],
        }),
      ).not.toThrow();
    }

    const plain = compPlain as Structure;
    const mesa = duoMesa as Structure;
    const plainIndices = plain.inspect().indices;
    const mesaIndices = mesa.inspect().indices;

    for (let y = 0; y < 40; y += 1) {
      for (let z = 0; z < 30; z += 1) {
        expect(plainIndices[zyxIndex(plain.size, 29, y, z)]).toBe(
          mesaIndices[zyxIndex(mesa.size, 0, y, z)],
        );
      }
    }
  });
});
