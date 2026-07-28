// Structure generator index.
//
// Every island lives in its own `tools/structures/<island>.mjs` module so that
// parallel content work never touches the same file. Adding an island means:
//   1. create `tools/structures/<island>.mjs` exporting `island`;
//   2. add one alphabetically sorted import below;
//   3. add its alias to `ISLAND_MODULES`.
//
// Output is byte-identical for a given set of modules: modules are sorted by id
// before writing and no generator reads wall-clock time or Math.random.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { island as aetherSanctum } from "./structures/aether_sanctum.mjs";
import { island as ambientDesert } from "./structures/ambient_desert.mjs";
import { island as ambientTundra } from "./structures/ambient_tundra.mjs";
import { island as ambientVerdant } from "./structures/ambient_verdant.mjs";
import { island as ambientVolcanic } from "./structures/ambient_volcanic.mjs";
import { island as ashfallCrater } from "./structures/ashfall_crater.mjs";
import { island as compBridge } from "./structures/comp_bridge.mjs";
import { island as compChasm } from "./structures/comp_chasm.mjs";
import { island as compCoast } from "./structures/comp_coast.mjs";
import { island as compLake } from "./structures/comp_lake.mjs";
import { island as compPlain } from "./structures/comp_plain.mjs";
import { island as compRidge } from "./structures/comp_ridge.mjs";
import { island as cragDesert } from "./structures/crag_desert.mjs";
import { island as cragTundra } from "./structures/crag_tundra.mjs";
import { island as cragVerdant } from "./structures/crag_verdant.mjs";
import { island as cragVolcanic } from "./structures/crag_volcanic.mjs";
import { island as cragVolcanicEmber } from "./structures/crag_volcanic_ember.mjs";
import { island as duoMesa } from "./structures/duo_mesa.mjs";
import { island as emberOutpost } from "./structures/ember_outpost.mjs";
import { island as frostspire } from "./structures/frostspire.mjs";
import { island as gametestPlatform } from "./structures/gametest_platform.mjs";
import { island as glacierVault } from "./structures/glacier_vault.mjs";
import { island as isletDesert } from "./structures/islet_desert.mjs";
import { island as isletTundra } from "./structures/islet_tundra.mjs";
import { island as isletVerdant } from "./structures/islet_verdant.mjs";
import { island as isletVolcanic } from "./structures/islet_volcanic.mjs";
import { island as landmarkDesert } from "./structures/landmark_desert.mjs";
import { island as landmarkTundra } from "./structures/landmark_tundra.mjs";
import { island as landmarkVerdant } from "./structures/landmark_verdant.mjs";
import { island as landmarkVolcanic } from "./structures/landmark_volcanic.mjs";
import { island as landmarkVolcanicEmber } from "./structures/landmark_volcanic_ember.mjs";
import { island as landmarkVolcanicPyre } from "./structures/landmark_volcanic_pyre.mjs";
import { island as starterIsland } from "./structures/starter_island.mjs";
import { island as sunspireReach } from "./structures/sunspire_reach.mjs";
import { island as verdantHollow } from "./structures/verdant_hollow.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

const ISLAND_MODULES = [
  aetherSanctum,
  ambientDesert,
  ambientTundra,
  ambientVerdant,
  ambientVolcanic,
  ashfallCrater,
  compBridge,
  compChasm,
  compCoast,
  compLake,
  compPlain,
  compRidge,
  cragDesert,
  cragTundra,
  cragVerdant,
  cragVolcanic,
  cragVolcanicEmber,
  duoMesa,
  emberOutpost,
  frostspire,
  gametestPlatform,
  glacierVault,
  isletDesert,
  isletTundra,
  isletVerdant,
  isletVolcanic,
  landmarkDesert,
  landmarkTundra,
  landmarkVerdant,
  landmarkVolcanic,
  landmarkVolcanicEmber,
  landmarkVolcanicPyre,
  starterIsland,
  sunspireReach,
  verdantHollow,
].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));

for (const module of ISLAND_MODULES) {
  const target = path.join(root, ...module.outputPath);
  const data = module.build();

  if (checkOnly) {
    let existing;

    try {
      existing = await readFile(target);
    } catch {
      throw new Error(
        `Generated structure is missing: ${path.relative(root, target)}`,
      );
    }

    if (!existing.equals(data)) {
      throw new Error(
        `Generated structure is stale: ${path.relative(root, target)}`,
      );
    }
  } else {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  process.stdout.write(
    `${checkOnly ? "Verified" : "Generated"} ${path.relative(root, target)} (${data.length} bytes)\n`,
  );
}
