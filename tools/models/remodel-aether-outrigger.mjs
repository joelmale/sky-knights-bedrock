import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import prettier from "prettier";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const importedModel = path.join(
  root,
  "dist",
  "world-template",
  "sky_knights_world",
  "resource_packs",
  "sk_rp",
  "models",
  "entity",
  "aether_outrigger.geo.bbmodel",
);
const sourceModel = path.join(
  root,
  "art_source",
  "blockbench",
  "aether_outrigger.geo.bbmodel",
);
const geometryOutput = path.join(
  root,
  "resource_packs",
  "sk_rp",
  "models",
  "entity",
  "aether_outrigger.geo.json",
);
const textureOutput = path.join(
  root,
  "resource_packs",
  "sk_rp",
  "textures",
  "entity",
  "skyknights",
  "aether_outrigger.png",
);

const model = JSON.parse(
  await readFile(sourceModel, "utf8").catch(async (error) => {
    if (error?.code !== "ENOENT") throw error;
    return readFile(importedModel, "utf8");
  }),
);

if (
  model?.meta?.model_format !== "bedrock" ||
  model?.model_identifier !== "skyknights.aether_outrigger" ||
  !Array.isArray(model.elements) ||
  !Array.isArray(model.groups) ||
  !Array.isArray(model.outliner)
) {
  throw new Error("The Aether Outrigger Blockbench source is not recognized.");
}

model.name = "aether_outrigger.geo";
const requiresScaleUp = model.visible_box?.[0] < 10;
if (requiresScaleUp) {
  for (const element of model.elements) {
    element.from = element.from.map((value) => value * 2);
    element.to = element.to.map((value) => value * 2);
    if (Array.isArray(element.origin)) {
      element.origin = element.origin.map((value) => value * 2);
    }
  }
  for (const group of model.groups) {
    group.origin = group.origin.map((value) => value * 2);
  }
}

model.visible_box = [14, 12, 5];
model.resolution = { width: 256, height: 256 };

const elements = new Map(
  model.elements.map((element) => [element.uuid, element]),
);
const groups = new Map(model.groups.map((group) => [group.uuid, group]));

updateElement("721636c0-741e-9943-1468-3252166df071", {
  name: "keel",
});
updateElement("e4e9b9df-749e-311c-6bfc-61e3e582861f", {
  name: "gunwale_right",
});
updateElement("3a1299b7-d2e6-560b-1889-16b7a46af440", {
  name: "gunwale_left",
});
updateElement("14c00f7d-d444-6f1a-c534-1ebc0dde7504", {
  name: "stern_wall",
});
updateElement("948d6441-f5b6-4b03-331b-aad3cfc6e698", {
  name: "helm_console",
});

updateElement("6030ad0c-6b16-edc4-3eae-54461086cce7", {
  name: "engine_housing",
});
updateElement("0a5323d0-96d8-a0c2-0e4d-4ef9bf57d479", {
  name: "engine_nozzle_lower_left",
});
updateElement("b5d7a31e-edcf-fc9d-ba4a-b526e5149f08", {
  name: "engine_nozzle_lower_right",
});
updateElement("bfb27833-287c-e083-c973-ff788a1e50b8", {
  name: "engine_nozzle_upper_left",
});
updateElement("e1416f92-9a25-7a35-f5a4-fd990eaa0834", {
  name: "engine_nozzle_upper_right",
});

updateElement("57ec8d3c-eea5-97fb-8e61-836070a6a423", {
  name: "lift_strut_left_forward",
  from: [-26, 8, 6],
  to: [-16, 12, 10],
});
updateElement("50fee10b-7f74-84a9-5396-4e6268dae3a4", {
  name: "lift_strut_left_aft",
  from: [-26, 8, 26],
  to: [-16, 12, 30],
});
updateElement("d6704dac-5b55-9d93-968b-b56a17aceb8a", {
  name: "lift_core_left",
  from: [-38, 4, 0],
  to: [-26, 16, 38],
});
updateElement("64d6ae58-bb33-5576-41d9-efd154c0dae7", {
  name: "lift_band_left_forward",
  from: [-40, 2, -2],
  to: [-24, 18, 6],
});
updateElement("78769df6-17b9-62af-e0a4-92e2ea342a85", {
  name: "lift_band_left_aft",
  from: [-40, 2, 38],
  to: [-24, 18, 46],
});

updateElement("52cf813c-2e1c-b9d9-48f1-7fcc47aae530", {
  name: "lift_strut_right_forward",
  from: [16, 8, 6],
  to: [26, 12, 10],
});
updateElement("79a10d6a-7580-7338-0009-2e74f8133de6", {
  name: "lift_strut_right_aft",
  from: [16, 8, 26],
  to: [26, 12, 30],
});
updateElement("f849b1ef-8490-021d-5e8e-f8c675d18b18", {
  name: "lift_core_right",
  from: [26, 4, 0],
  to: [38, 16, 38],
});
updateElement("cc7d64af-9bad-abbd-5d9a-95c209cdb39c", {
  name: "lift_band_right_forward",
  from: [24, 2, -2],
  to: [40, 18, 6],
});
updateElement("c8235cf8-3361-6bf3-ad4a-33ec02394fb9", {
  name: "lift_band_right_aft",
  from: [24, 2, 38],
  to: [40, 18, 46],
});

updateElement("5739fc3c-df06-df0a-fb3c-8b84121f67a8", {
  name: "mast",
  from: [-2, 8, 14],
  to: [2, 90, 18],
});
updateElement("3cf97fca-3238-ba68-d411-8f9116c55322", {
  name: "yard_upper",
  from: [-24, 86, 12],
  to: [24, 90, 16],
});
updateElement("70c4ac9b-159b-0cb2-d2b9-0292fa8e5fab", {
  name: "yard_lower",
  from: [-24, 44, 12],
  to: [24, 48, 16],
});
updateElement("3f9bfc44-2256-1e59-cb6a-c31e90fad3dc", {
  name: "sail_main",
  from: [-22, 56, 14],
  to: [22, 76, 18],
  origin: [0, 66, 16],
  rotation: [0, 0, 0],
});
updateElement("22a878f7-0fd0-2298-1717-5711fabdd5e9", {
  name: "sail_upper",
  from: [-22, 76, 14],
  to: [22, 88, 18],
  origin: [0, 82, 16],
  rotation: [0, 0, 0],
});
updateElement("42554d03-ec7f-5c07-83ac-30550fce44f3", {
  name: "sail_lower",
  from: [-22, 44, 14],
  to: [22, 56, 18],
  origin: [0, 50, 16],
  rotation: [0, 0, 0],
});

updateGroup("bb2019ec-33f0-0bf6-5cb5-1cca6c982751", {
  name: "lift_pod_left",
  origin: [-22, 10, 16],
});
updateGroup("43d6dfe7-3d52-4a8b-6971-8439cfe093a6", {
  name: "lift_pod_right",
  origin: [22, 10, 16],
});
updateGroup("89a0e0ce-1005-a97c-6a39-da8dd4c44120", {
  origin: [0, 8, 16],
  rotation: [0, 0, 0],
});
updateGroup("e217bc04-a81a-d44f-d8a9-e8b7cea5db46", {
  origin: [0, 66, 16],
  rotation: [0, 0, 0],
});

const texture = model.textures?.find(
  (candidate) => candidate.name === "aether_outrigger.png",
);
const encodedTexture = texture?.source?.match(
  /^data:image\/png;base64,(?<payload>.+)$/u,
)?.groups?.payload;

if (encodedTexture === undefined) {
  throw new Error("The Blockbench source has no embedded Outrigger texture.");
}

await mkdir(path.dirname(sourceModel), { recursive: true });
await mkdir(path.dirname(geometryOutput), { recursive: true });
await mkdir(path.dirname(textureOutput), { recursive: true });
await writeFile(sourceModel, `${JSON.stringify(model)}\n`);
await writeFile(
  geometryOutput,
  await prettier.format(JSON.stringify(exportGeometry(model)), {
    parser: "json",
  }),
);
await writeFile(textureOutput, Buffer.from(encodedTexture, "base64"));

process.stdout.write(`Updated Blockbench source: ${sourceModel}\n`);
process.stdout.write(`Exported geometry: ${geometryOutput}\n`);
process.stdout.write(`Exported texture: ${textureOutput}\n`);

function updateElement(uuid, values) {
  const element = elements.get(uuid);
  if (element === undefined) {
    throw new Error(`Missing Blockbench element ${uuid}.`);
  }
  Object.assign(element, values);
}

function updateGroup(uuid, values) {
  const group = groups.get(uuid);
  if (group === undefined) {
    throw new Error(`Missing Blockbench group ${uuid}.`);
  }
  Object.assign(group, values);
}

function exportGeometry(blockbench) {
  const elementById = new Map(
    blockbench.elements.map((element) => [element.uuid, element]),
  );
  const groupById = new Map(
    blockbench.groups.map((group) => [group.uuid, group]),
  );
  const bones = [];

  for (const node of blockbench.outliner) {
    exportBone(node, undefined);
  }

  return {
    format_version: "1.12.0",
    "minecraft:geometry": [
      {
        description: {
          identifier: `geometry.${blockbench.model_identifier}`,
          texture_width: blockbench.resolution.width,
          texture_height: blockbench.resolution.height,
          visible_bounds_width: blockbench.visible_box[0],
          visible_bounds_height: blockbench.visible_box[1],
          visible_bounds_offset: [0, blockbench.visible_box[2], 0],
        },
        bones,
      },
    ],
  };

  function exportBone(node, parent) {
    const group = groupById.get(node.uuid);
    if (group === undefined) {
      throw new Error(`Missing Blockbench outliner group ${node.uuid}.`);
    }
    const bone = {
      name: group.name,
      pivot: group.origin,
    };
    if (parent !== undefined) {
      bone.parent = parent;
    }
    if (group.rotation?.some((value) => value !== 0)) {
      bone.rotation = [
        -group.rotation[0],
        -group.rotation[1],
        group.rotation[2],
      ];
    }
    const cubes = [];
    for (const child of node.children ?? []) {
      if (typeof child === "string") {
        const element = elementById.get(child);
        if (element === undefined) {
          throw new Error(`Missing Blockbench cube ${child}.`);
        }
        cubes.push(exportCube(element));
      } else {
        exportBone(child, group.name);
      }
    }
    if (cubes.length > 0) {
      bone.cubes = cubes;
    }
    bones.push(bone);
  }
}

function exportCube(element) {
  const cube = {
    origin: element.from,
    size: element.to.map((value, index) => value - element.from[index]),
    uv: element.uv_offset ?? [0, 0],
  };
  if (element.inflate !== undefined && element.inflate !== 0) {
    cube.inflate = element.inflate;
  }
  if (element.rotation?.some((value) => value !== 0)) {
    cube.pivot = element.origin;
    cube.rotation = [
      -element.rotation[0],
      -element.rotation[1],
      element.rotation[2],
    ];
  }
  return cube;
}
