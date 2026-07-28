import {
  TAG,
  readLevelDat,
  setByte,
  setInt,
  setLong,
  setString,
  writeLevelDat,
} from "./nbt.mjs";

export const CANONICAL_VOID_LAYERS =
  '{"biome_id":1,"block_layers":[{"block_name":"minecraft:air","count":1}],"encoding_version":6,"preset_id":null,"structure_options":null,"world_version":"version.post_1_18"}\n';
export const VOID_SOURCE_METADATA = {
  levelName: "Sky Knights: Void Realm",
  randomSeed: 1_702_740_741,
  gameType: 0,
  forceGameType: 1,
  cheatsEnabled: 1,
  commandsEnabled: 1,
  spawn: {
    x: 10,
    y: 161,
    z: 1,
  },
};

function requireTag(compound, name, type) {
  const tag = compound.get(name);

  if (tag?.type !== type) {
    throw new Error(
      `Expected level.dat ${name} to be tag type ${type}, found ${String(tag?.type)}.`,
    );
  }

  return tag;
}

function parseLayers(value, context) {
  let layers;

  try {
    layers = JSON.parse(value);
  } catch (error) {
    throw new Error(
      `${context} FlatWorldLayers is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
    );
  }

  if (layers === null || typeof layers !== "object" || Array.isArray(layers)) {
    throw new Error(`${context} FlatWorldLayers must be a JSON object.`);
  }

  return layers;
}

function assertBootstrapLayers(layers) {
  if (
    layers.encoding_version !== 6 ||
    layers.world_version !== "version.post_1_18" ||
    !Array.isArray(layers.block_layers)
  ) {
    throw new Error(
      "BDS bootstrap FlatWorldLayers does not match the approved encoding-6 post-1.18 schema.",
    );
  }
}

function assertCanonicalVoidLayers(layers) {
  const keys = Object.keys(layers).sort();
  const expectedKeys = [
    "biome_id",
    "block_layers",
    "encoding_version",
    "preset_id",
    "structure_options",
    "world_version",
  ].sort();

  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    throw new Error(
      `Void FlatWorldLayers contains unexpected fields: ${keys.join(", ")}.`,
    );
  }

  if (
    layers.biome_id !== 1 ||
    layers.encoding_version !== 6 ||
    layers.preset_id !== null ||
    layers.structure_options !== null ||
    layers.world_version !== "version.post_1_18" ||
    !Array.isArray(layers.block_layers) ||
    layers.block_layers.length !== 1
  ) {
    throw new Error(
      "Void FlatWorldLayers does not match the canonical schema.",
    );
  }

  const [layer] = layers.block_layers;

  if (
    layer === null ||
    typeof layer !== "object" ||
    Array.isArray(layer) ||
    JSON.stringify(Object.keys(layer).sort()) !==
      JSON.stringify(["block_name", "count"]) ||
    layer.block_name !== "minecraft:air" ||
    layer.count !== 1
  ) {
    throw new Error(
      "Void FlatWorldLayers must contain exactly one one-block minecraft:air layer.",
    );
  }
}

function inspectDisabledExperiments(root) {
  const experiments = requireTag(root, "experiments", TAG.Compound).value;
  const flags = {};

  for (const [name, tag] of experiments) {
    if (tag.type !== TAG.Byte) {
      throw new Error(
        `Void source experiment ${name} must be a Byte tag; found ${String(tag.type)}.`,
      );
    }

    flags[name] = tag.value;

    if (tag.value !== 0) {
      throw new Error(
        `Void source experiment ${name} must remain disabled; found ${String(tag.value)}.`,
      );
    }
  }

  for (const name of [
    "experiments_ever_used",
    "saved_with_toggled_experiments",
  ]) {
    if (flags[name] !== 0) {
      throw new Error(
        `Void source experiment bookkeeping flag ${name} must be present and 0.`,
      );
    }
  }

  return flags;
}

export function patchVoidLevelDat(buffer) {
  const level = readLevelDat(buffer);
  requireTag(level.root, "Generator", TAG.Int);
  const flatWorldLayers = requireTag(level.root, "FlatWorldLayers", TAG.String);
  assertBootstrapLayers(parseLayers(flatWorldLayers.value, "BDS bootstrap"));
  requireTag(level.root, "RandomSeed", TAG.Long);
  requireTag(level.root, "GameType", TAG.Int);
  requireTag(level.root, "ForceGameType", TAG.Byte);
  requireTag(level.root, "cheatsEnabled", TAG.Byte);
  requireTag(level.root, "commandsEnabled", TAG.Byte);
  requireTag(level.root, "LevelName", TAG.String);
  requireTag(level.root, "SpawnX", TAG.Int);
  requireTag(level.root, "SpawnY", TAG.Int);
  requireTag(level.root, "SpawnZ", TAG.Int);

  setInt(level.root, "Generator", 2);
  setString(level.root, "FlatWorldLayers", CANONICAL_VOID_LAYERS);
  setLong(level.root, "RandomSeed", VOID_SOURCE_METADATA.randomSeed);
  setInt(level.root, "GameType", VOID_SOURCE_METADATA.gameType);
  setByte(level.root, "ForceGameType", VOID_SOURCE_METADATA.forceGameType);
  setByte(level.root, "cheatsEnabled", VOID_SOURCE_METADATA.cheatsEnabled);
  setByte(level.root, "commandsEnabled", VOID_SOURCE_METADATA.commandsEnabled);
  setString(level.root, "LevelName", VOID_SOURCE_METADATA.levelName);
  setInt(level.root, "SpawnX", VOID_SOURCE_METADATA.spawn.x);
  setInt(level.root, "SpawnY", VOID_SOURCE_METADATA.spawn.y);
  setInt(level.root, "SpawnZ", VOID_SOURCE_METADATA.spawn.z);
  inspectDisabledExperiments(level.root);
  const patched = writeLevelDat(level);

  inspectVoidLevelDat(patched);
  return patched;
}

export function inspectVoidLevelDat(
  buffer,
  { requireClientMetadata = true } = {},
) {
  const level = readLevelDat(buffer);
  const generator = requireTag(level.root, "Generator", TAG.Int).value;
  const flatWorldLayers = requireTag(
    level.root,
    "FlatWorldLayers",
    TAG.String,
  ).value;

  if (generator !== 2) {
    throw new Error(`Void level.dat Generator must be 2; found ${generator}.`);
  }

  const layers = parseLayers(flatWorldLayers, "Void");
  assertCanonicalVoidLayers(layers);
  const experiments = inspectDisabledExperiments(level.root);
  const metadata = {
    levelName: requireTag(level.root, "LevelName", TAG.String).value,
    randomSeed: Number(requireTag(level.root, "RandomSeed", TAG.Long).value),
    gameType: requireTag(level.root, "GameType", TAG.Int).value,
    forceGameType: requireTag(level.root, "ForceGameType", TAG.Byte).value,
    cheatsEnabled: requireTag(level.root, "cheatsEnabled", TAG.Byte).value,
    commandsEnabled: requireTag(level.root, "commandsEnabled", TAG.Byte).value,
    spawn: {
      x: requireTag(level.root, "SpawnX", TAG.Int).value,
      y: requireTag(level.root, "SpawnY", TAG.Int).value,
      z: requireTag(level.root, "SpawnZ", TAG.Int).value,
    },
  };

  if (
    requireClientMetadata &&
    JSON.stringify(metadata) !== JSON.stringify(VOID_SOURCE_METADATA)
  ) {
    throw new Error(
      `Void source client metadata does not match the canonical defaults: ${JSON.stringify(metadata)}.`,
    );
  }

  return {
    storageVersion: level.storageVersion,
    generator,
    flatWorldLayers,
    layers,
    experiments,
    ...metadata,
  };
}
