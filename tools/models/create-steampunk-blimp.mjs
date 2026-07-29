import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import prettier from "prettier";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const sourceOutput = path.join(
  root,
  "art_source",
  "blockbench",
  "steampunk_blimp.geo.bbmodel",
);
const geometryOutput = path.join(
  root,
  "resource_packs",
  "sk_rp",
  "models",
  "entity",
  "steampunk_blimp.geo.json",
);

const textureWidth = 256;
const textureHeight = 256;
const materials = {
  canvas: { uv: [2, 2], size: [92, 48] },
  rib: { uv: [98, 2], size: [64, 40] },
  tailVertical: { uv: [114, 90], size: [20, 16] },
  tailHorizontal: { uv: [138, 90], size: [36, 8] },
  hull: { uv: [2, 138], size: [68, 22] },
  roof: { uv: [50, 162], size: [56, 16] },
  woodDark: { uv: [98, 226], size: [28, 28] },
  copper: { uv: [130, 226], size: [28, 28] },
  engine: { uv: [166, 2], size: [28, 12] },
  glass: { uv: [78, 143], size: [8, 9] },
  aether: { uv: [226, 226], size: [28, 28] },
  propellerHub: { uv: [197, 1], size: [6, 2] },
  propellerBlade: { uv: [194, 226], size: [28, 28] },
  rope: { uv: [98, 226], size: [28, 28] },
};

const bones = [
  bone("root", [0, 0, 0]),
  bone(
    "balloon",
    [0, 46, 0],
    [
      cube("envelope_core", [-18, 36, -28], [36, 20, 56], [0, 0]),
      cube("envelope_breadth", [-21, 39, -23], [42, 14, 46], [0, 0]),
      cube("envelope_crown", [-15, 56, -24], [30, 4, 48], [0, 0]),
      cube("envelope_keel", [-15, 32, -24], [30, 4, 48], [0, 0]),
      cube("envelope_nose_shoulder", [-16, 37, -36], [32, 18, 8], [0, 0]),
      cube("envelope_nose_taper", [-12, 39, -42], [24, 14, 6], [0, 0]),
      cube("envelope_nose_cap", [-6, 42, -47], [12, 8, 5], [0, 0]),
      cube("envelope_nose_point", [-2, 44, -51], [4, 4, 4], [0, 0]),
      cube("envelope_stern_shoulder", [-16, 37, 28], [32, 18, 8], [0, 0]),
      cube("envelope_stern_taper", [-12, 39, 36], [24, 14, 6], [0, 0]),
      cube("envelope_stern_cap", [-6, 42, 42], [12, 8, 5], [0, 0]),
    ],
    "root",
    1,
  ),
  bone(
    "balloon_ribs",
    [0, 46, 0],
    [
      ...[-21, -10, 0, 10, 21].flatMap((z, index) => [
        cube(`rib_${index}_top`, [-16, 60, z - 1], [32, 2, 2], [160, 0]),
        cube(`rib_${index}_bottom`, [-16, 30, z - 1], [32, 2, 2], [160, 0]),
        cube(`rib_${index}_left`, [-23, 34, z - 1], [2, 24, 2], [160, 0]),
        cube(`rib_${index}_right`, [21, 34, z - 1], [2, 24, 2], [160, 0]),
      ]),
      cube("rail_port", [-22, 43, -39], [2, 4, 78], [0, 80]),
      cube("rail_starboard", [20, 43, -39], [2, 4, 78], [0, 80]),
      cube("spine_top", [-2, 59, -33], [4, 2, 66], [0, 80]),
      cube("spine_bottom", [-2, 31, -33], [4, 2, 66], [0, 80]),
      cube("nose_band_top", [-10, 52, -41], [20, 2, 4], [160, 0]),
      cube("nose_band_bottom", [-10, 38, -41], [20, 2, 4], [160, 0]),
      cube("stern_band_top", [-10, 52, 37], [20, 2, 4], [160, 0]),
      cube("stern_band_bottom", [-10, 38, 37], [20, 2, 4], [160, 0]),
    ],
    "balloon",
    2,
  ),
  bone(
    "tail_fins",
    [0, 46, 42],
    [
      cube("tail_boom", [-2, 43, 39], [4, 4, 17], [160, 0]),
      cube(
        "vertical_fin_upper_root",
        [-2, 54, 34],
        [4, 12, 15],
        "tailVertical",
      ),
      cube("vertical_fin_upper_tip", [-2, 66, 39], [4, 8, 10], "tailVertical"),
      cube("vertical_fin_lower_root", [-2, 26, 34], [4, 8, 15], "tailVertical"),
      cube("vertical_fin_lower_tip", [-2, 20, 39], [4, 6, 10], "tailVertical"),
      cube(
        "horizontal_fin_port_root",
        [-28, 43, 35],
        [16, 4, 14],
        "tailHorizontal",
      ),
      cube(
        "horizontal_fin_port_tip",
        [-36, 43, 40],
        [8, 4, 9],
        "tailHorizontal",
      ),
      cube(
        "horizontal_fin_starboard_root",
        [12, 43, 35],
        [16, 4, 14],
        "tailHorizontal",
      ),
      cube(
        "horizontal_fin_starboard_tip",
        [28, 43, 40],
        [8, 4, 9],
        "tailHorizontal",
      ),
      cube("tail_fin_band", [-3, 42, 45], [6, 6, 3], [176, 96]),
    ],
    "balloon",
    3,
  ),
  bone(
    "rigging",
    [0, 26, 0],
    [
      cube("suspension_port_forward", [-11, 19, -23], [2, 14, 2], [224, 160]),
      cube(
        "suspension_starboard_forward",
        [9, 19, -23],
        [2, 14, 2],
        [224, 160],
      ),
      cube("suspension_port_mid", [-11, 20, -1], [2, 13, 2], [224, 160]),
      cube("suspension_starboard_mid", [9, 20, -1], [2, 13, 2], [224, 160]),
      cube("suspension_port_aft", [-11, 19, 21], [2, 14, 2], [224, 160]),
      cube("suspension_starboard_aft", [9, 19, 21], [2, 14, 2], [224, 160]),
      cube("crossbeam_forward", [-13, 30, -24], [26, 2, 4], [128, 96]),
      cube("crossbeam_mid", [-13, 30, -2], [26, 2, 4], [128, 96]),
      cube("crossbeam_aft", [-13, 30, 20], [26, 2, 4], [128, 96]),
      cube("brace_port_forward", [-11, 20, -24], [2, 18, 2], [224, 160], {
        pivot: [-10, 20, -23],
        rotation: [-35, 0, 0],
      }),
      cube("brace_starboard_forward", [9, 20, -24], [2, 18, 2], [224, 160], {
        pivot: [10, 20, -23],
        rotation: [-35, 0, 0],
      }),
      cube("brace_port_aft", [-11, 20, 22], [2, 18, 2], [224, 160], {
        pivot: [-10, 20, 23],
        rotation: [35, 0, 0],
      }),
      cube("brace_starboard_aft", [9, 20, 22], [2, 18, 2], [224, 160], {
        pivot: [10, 20, 23],
        rotation: [35, 0, 0],
      }),
    ],
    "root",
    4,
  ),
  bone(
    "gondola",
    [0, 10, 0],
    [
      cube("keel", [-7, 1, -31], [14, 3, 61], [0, 168]),
      cube("lower_hull", [-10, 4, -29], [20, 4, 57], [0, 168]),
      cube("main_deck", [-13, 8, -27], [26, 4, 53], [0, 168]),
      cube("hull_port", [-15, 7, -24], [3, 9, 48], [0, 168]),
      cube("hull_starboard", [12, 7, -24], [3, 9, 48], [0, 168]),
      cube("stern_bulkhead", [-12, 8, 24], [24, 8, 4], [128, 96]),
      cube("bow_block", [-10, 6, -34], [20, 7, 7], [0, 168]),
      cube("bow_taper", [-6, 7, -40], [12, 5, 6], [0, 168]),
      cube("bow_point", [-2, 8, -45], [4, 3, 5], [0, 168]),
      cube("bowsprit", [-1, 10, -53], [2, 2, 12], [128, 96]),
      cube("rail_port", [-16, 16, -27], [2, 2, 53], [0, 80]),
      cube("rail_starboard", [14, 16, -27], [2, 2, 53], [0, 80]),
      cube("rail_bow", [-14, 16, -29], [28, 2, 2], [0, 80]),
      cube("rail_stern", [-14, 16, 26], [28, 2, 2], [0, 80]),
      ...[-24, -12, 0, 12, 24].flatMap((z, index) => [
        cube(`rail_post_port_${index}`, [-16, 12, z], [2, 5, 2], [128, 96]),
        cube(`rail_post_starboard_${index}`, [14, 12, z], [2, 5, 2], [128, 96]),
      ]),
      cube("helm_pedestal", [-3, 12, -18], [6, 5, 5], [176, 96]),
      cube("helm_wheel_hub", [-1, 16, -18], [2, 4, 2], [176, 96]),
      cube("helm_wheel_cross", [-5, 17, -19], [10, 2, 2], [176, 96]),
      cube("helm_wheel_vertical", [-1, 13, -19], [2, 10, 2], [176, 96]),
      cube("stern_aether_console", [-5, 12, 20], [10, 5, 4], [224, 96]),
    ],
    "root",
    5,
  ),
  bone(
    "cabin",
    [0, 16, 6],
    [
      cube("cabin_body", [-10, 11, -4], [20, 12, 23], [0, 168]),
      cube("cabin_roof", [-12, 23, -6], [24, 3, 27], "roof"),
      cube("cabin_front", [-9, 13, -7], [18, 9, 3], [0, 168]),
      cube("window_port", [-10.5, 15, 1], [1, 6, 7], [208, 96]),
      cube("window_port_aft", [-10.5, 15, 11], [1, 6, 5], [208, 96]),
      cube("window_starboard", [9.5, 15, 1], [1, 6, 7], [208, 96]),
      cube("window_starboard_aft", [9.5, 15, 11], [1, 6, 5], [208, 96]),
      cube("front_window", [-5, 16, -7.5], [10, 5, 1], [208, 96]),
      cube("smokestack", [-3, 26, 10], [6, 10, 6], [176, 96]),
      cube("smokestack_cap", [-5, 35, 8], [10, 3, 10], [176, 96]),
      cube("cabin_aether_gauge", [-2, 17, -8], [4, 4, 1], [224, 96]),
    ],
    "gondola",
    6,
  ),
  bone(
    "engine_left",
    [19, 13, 17],
    [
      cube("engine_left_core", [15, 9, 7], [8, 8, 21], "engine"),
      cube("engine_left_band_forward", [14, 8, 6], [10, 10, 4], [176, 96]),
      cube("engine_left_band_aft", [14, 8, 25], [10, 10, 4], [176, 96]),
      cube("engine_left_aether_cell", [22.5, 11, 13], [1, 4, 9], [224, 96]),
      cube("engine_left_mount", [11, 11, 11], [5, 4, 4], [128, 96]),
      cube("engine_left_mount_aft", [11, 11, 21], [5, 4, 4], [128, 96]),
      cube("engine_left_stack", [17, 17, 14], [4, 8, 4], [176, 96]),
      cube("engine_left_stack_cap", [16, 24, 13], [6, 2, 6], [176, 96]),
    ],
    "gondola",
    7,
  ),
  bone(
    "engine_right",
    [-19, 13, 17],
    [
      cube("engine_right_core", [-23, 9, 7], [8, 8, 21], "engine"),
      cube("engine_right_band_forward", [-24, 8, 6], [10, 10, 4], [176, 96]),
      cube("engine_right_band_aft", [-24, 8, 25], [10, 10, 4], [176, 96]),
      cube("engine_right_aether_cell", [-23.5, 11, 13], [1, 4, 9], [224, 96]),
      cube("engine_right_mount", [-16, 11, 11], [5, 4, 4], [128, 96]),
      cube("engine_right_mount_aft", [-16, 11, 21], [5, 4, 4], [128, 96]),
      cube("engine_right_stack", [-21, 17, 14], [4, 8, 4], [176, 96]),
      cube("engine_right_stack_cap", [-22, 24, 13], [6, 2, 6], [176, 96]),
    ],
    "gondola",
    8,
  ),
  bone(
    "propeller_left",
    [19, 13, 31],
    [
      cube("propeller_left_hub", [16, 10, 28], [6, 6, 5], [176, 160]),
      cube("propeller_left_blade_a", [18, 0, 31], [2, 26, 1], [160, 160], {
        pivot: [19, 13, 31.5],
        rotation: [0, 0, 45],
      }),
      cube("propeller_left_blade_b", [18, 0, 31], [2, 26, 1], [160, 160], {
        pivot: [19, 13, 31.5],
        rotation: [0, 0, -45],
      }),
    ],
    "engine_left",
    9,
  ),
  bone(
    "propeller_right",
    [-19, 13, 31],
    [
      cube("propeller_right_hub", [-22, 10, 28], [6, 6, 5], [176, 160]),
      cube("propeller_right_blade_a", [-20, 0, 31], [2, 26, 1], [160, 160], {
        pivot: [-19, 13, 31.5],
        rotation: [0, 0, 45],
      }),
      cube("propeller_right_blade_b", [-20, 0, 31], [2, 26, 1], [160, 160], {
        pivot: [-19, 13, 31.5],
        rotation: [0, 0, -45],
      }),
    ],
    "engine_right",
    10,
  ),
];

const geometry = {
  format_version: "1.12.0",
  "minecraft:geometry": [
    {
      description: {
        identifier: "geometry.skyknights.steampunk_blimp",
        texture_width: textureWidth,
        texture_height: textureHeight,
        visible_bounds_width: 12,
        visible_bounds_height: 10,
        visible_bounds_offset: [0, 5, 0],
      },
      bones: bones.map(exportBone),
    },
  ],
};

validateBoneContract(bones);
validateRibClearance(bones);
validateMaterialCoverage(bones);
const blockbench = createBlockbenchModel(bones);

await mkdir(path.dirname(sourceOutput), { recursive: true });
await mkdir(path.dirname(geometryOutput), { recursive: true });
await writeFile(sourceOutput, `${JSON.stringify(blockbench)}\n`);
await writeFile(
  geometryOutput,
  await prettier.format(JSON.stringify(geometry), { parser: "json" }),
);

process.stdout.write(`Created Blockbench source: ${sourceOutput}\n`);
process.stdout.write(`Exported Bedrock geometry: ${geometryOutput}\n`);
process.stdout.write(
  `Exported ${bones.length} bones and ${bones.reduce((sum, entry) => sum + entry.cubes.length, 0)} cubes.\n`,
);

function bone(name, pivot, cubes = [], parent, color = 0) {
  return {
    name,
    pivot,
    cubes,
    ...(parent === undefined ? {} : { parent }),
    color,
  };
}

function cube(name, origin, size, material, transform = {}) {
  return {
    name,
    origin,
    size,
    material: resolveMaterial(material),
    ...transform,
  };
}

function exportBone(entry) {
  return {
    name: entry.name,
    ...(entry.parent === undefined ? {} : { parent: entry.parent }),
    pivot: entry.pivot,
    ...(entry.cubes.length === 0
      ? {}
      : {
          cubes: entry.cubes.map((entryCube) => ({
            origin: entryCube.origin,
            size: entryCube.size,
            uv: createBedrockFaceUvs(entryCube.material),
            ...(entryCube.pivot === undefined
              ? {}
              : { pivot: entryCube.pivot }),
            ...(entryCube.rotation === undefined
              ? {}
              : { rotation: entryCube.rotation }),
          })),
        }),
  };
}

function createBlockbenchModel(entries) {
  const groupByName = new Map(
    entries.map((entry) => [
      entry.name,
      {
        name: entry.name,
        uuid: deterministicUuid(`bone:${entry.name}`),
        export: true,
        locked: false,
        scope: 0,
        selected: false,
        _static: { properties: {}, temp_data: {} },
        origin: entry.pivot,
        rotation: [0, 0, 0],
        bedrock_binding: "",
        color: entry.color,
        children: [],
        reset: false,
        shade: true,
        mirror_uv: false,
        visibility: true,
        autouv: 0,
        isOpen: false,
        primary_selected: false,
      },
    ]),
  );
  const elements = [];
  const outlinerByName = new Map();

  for (const entry of entries) {
    const group = groupByName.get(entry.name);
    const children = [];
    for (const entryCube of entry.cubes) {
      const element = createBlockbenchCube(entry.name, entryCube, entry.color);
      elements.push(element);
      children.push(element.uuid);
    }
    outlinerByName.set(entry.name, {
      uuid: group.uuid,
      isOpen: false,
      children,
    });
  }

  const roots = [];
  for (const entry of entries) {
    const node = outlinerByName.get(entry.name);
    if (entry.parent === undefined) {
      roots.push(node);
      continue;
    }
    const parent = outlinerByName.get(entry.parent);
    if (parent === undefined) {
      throw new Error(`Unknown parent bone ${entry.parent}.`);
    }
    parent.children.push(node);
  }

  return {
    meta: {
      format_version: "5.0",
      model_format: "bedrock",
      box_uv: false,
    },
    name: "steampunk_blimp.geo",
    model_identifier: "skyknights.steampunk_blimp",
    visible_box: [12, 10, 5],
    variable_placeholders: "",
    multi_file_ruleset: "",
    variable_placeholder_buttons: [],
    bedrock_animation_mode: "entity",
    timeline_setups: [],
    unhandled_root_fields: {},
    resolution: {
      width: textureWidth,
      height: textureHeight,
    },
    elements,
    groups: [...groupByName.values()],
    outliner: roots,
    textures: [
      {
        name: "steampunk_blimp.png",
        relative_path:
          "../../resource_packs/sk_rp/textures/entity/skyknights/steampunk_blimp.png",
        folder: "",
        namespace: "",
        id: "0",
        group: "",
        scope: 0,
        width: textureWidth,
        height: textureHeight,
        uv_width: textureWidth,
        uv_height: textureHeight,
        particle: false,
        use_as_default: false,
        layers_enabled: false,
        sync_to_project: "",
        file_format: "png",
        render_mode: "default",
        render_sides: "auto",
        wrap_mode: "limited",
        pbr_channel: "color",
        fps: 7,
        frame_time: 1,
        frame_order_type: "loop",
        frame_order: "",
        frame_interpolate: false,
        visible: true,
        internal: false,
        saved: true,
        uuid: deterministicUuid("texture:steampunk_blimp"),
        source: "",
      },
    ],
  };
}

function createBlockbenchCube(boneName, entryCube, color) {
  const from = entryCube.origin;
  const to = entryCube.origin.map(
    (value, index) => value + entryCube.size[index],
  );
  return {
    name: entryCube.name,
    box_uv: false,
    render_order: "default",
    locked: false,
    export: true,
    scope: 0,
    allow_mirror_modeling: true,
    from,
    to,
    autouv: 0,
    color,
    ...(entryCube.rotation === undefined
      ? {}
      : {
          rotation: [
            -entryCube.rotation[0],
            -entryCube.rotation[1],
            entryCube.rotation[2],
          ],
        }),
    origin: entryCube.pivot ?? [0, 0, 0],
    faces: createBlockbenchFaces(entryCube.material),
    type: "cube",
    uuid: deterministicUuid(`cube:${boneName}:${entryCube.name}`),
  };
}

function createBedrockFaceUvs(materialName) {
  const { uv, size } = materials[materialName];
  return Object.fromEntries(
    ["north", "east", "south", "west", "up", "down"].map((face) => [
      face,
      { uv, uv_size: size },
    ]),
  );
}

function createBlockbenchFaces(materialName) {
  const { uv, size } = materials[materialName];
  const rectangle = [uv[0], uv[1], uv[0] + size[0], uv[1] + size[1]];
  return Object.fromEntries(
    ["north", "east", "south", "west", "up", "down"].map((face) => [
      face,
      { uv: rectangle, texture: 0 },
    ]),
  );
}

function resolveMaterial(candidate) {
  if (typeof candidate === "string") {
    if (materials[candidate] === undefined) {
      throw new Error(`Unknown blimp material ${candidate}.`);
    }
    return candidate;
  }
  const [u, v] = candidate;
  const key = `${u},${v}`;
  const materialName = {
    "0,0": "canvas",
    "160,0": "rib",
    "0,80": "rib",
    "0,168": "hull",
    "128,96": "woodDark",
    "176,96": "copper",
    "208,96": "glass",
    "224,96": "aether",
    "160,160": "propellerBlade",
    "176,160": "propellerHub",
    "224,160": "rope",
  }[key];
  if (materialName === undefined) {
    throw new Error(`Unmapped legacy UV origin ${key}.`);
  }
  return materialName;
}

function validateMaterialCoverage(entries) {
  for (const entry of entries) {
    for (const entryCube of entry.cubes) {
      const material = materials[entryCube.material];
      const [u, v] = material.uv;
      const [width, height] = material.size;
      if (
        u < 0 ||
        v < 0 ||
        width <= 0 ||
        height <= 0 ||
        u + width > textureWidth ||
        v + height > textureHeight
      ) {
        throw new Error(
          `${entry.name}/${entryCube.name} leaves the 256x256 texture.`,
        );
      }
    }
  }
}

function validateBoneContract(entries) {
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  if (byName.get("balloon")?.parent !== "root") {
    throw new Error("The balloon bone must be an explicit child of root.");
  }
}

function validateRibClearance(entries) {
  const ribBone = entries.find((entry) => entry.name === "balloon_ribs");
  if (ribBone === undefined) {
    throw new Error("The balloon_ribs bone is missing.");
  }
  for (let index = 0; index < 5; index += 1) {
    assertOutside(`rib_${index}_top`, 1, 60, "positive");
    assertOutside(`rib_${index}_bottom`, 1, 32, "negative");
    assertOutside(`rib_${index}_left`, 0, -21, "negative");
    assertOutside(`rib_${index}_right`, 0, 21, "positive");
  }

  function assertOutside(name, axis, skinCoordinate, direction) {
    const entryCube = ribBone.cubes.find(
      (candidate) => candidate.name === name,
    );
    if (entryCube === undefined) {
      throw new Error(`The ${name} clearance rib is missing.`);
    }
    const inner =
      direction === "positive"
        ? entryCube.origin[axis]
        : entryCube.origin[axis] + entryCube.size[axis];
    const outer =
      direction === "positive"
        ? entryCube.origin[axis] + entryCube.size[axis]
        : entryCube.origin[axis];
    const clearsSkin =
      direction === "positive"
        ? inner >= skinCoordinate && outer > skinCoordinate
        : inner <= skinCoordinate && outer < skinCoordinate;
    if (!clearsSkin) {
      throw new Error(`${name} is coplanar with the balloon skin.`);
    }
  }
}

function deterministicUuid(key) {
  const digest = createHash("sha256")
    .update(`sky-knights:steampunk-blimp:${key}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  digest[12] = "4";
  digest[16] = ((Number.parseInt(digest[16], 16) & 3) | 8).toString(16);
  const value = digest.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
