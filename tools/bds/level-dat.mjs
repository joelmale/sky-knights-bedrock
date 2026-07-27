import {
  TAG,
  readLevelDat,
  setByte,
  setInt,
  tagValue,
  writeLevelDat,
} from "./nbt.mjs";

const BETA_API_EXPERIMENT_KEYS = [
  "beta_apis",
  "experimental_creator_features",
  "gametest",
];

function requireTag(compound, name, type) {
  const tag = compound.get(name);

  if (tag?.type !== type) {
    throw new Error(
      `Expected level.dat ${name} to be tag type ${type}, found ${String(tag?.type)}.`,
    );
  }

  return tag;
}

/**
 * Enables the one GameTest experiment name verified for the BDS smoke build.
 * The runner permits inserting this key only after its first boot records the
 * exact supported BDS version; the second boot and named test are the runtime
 * proof that the local binary accepts it.
 */
export function patchGameTestLevelDat(buffer) {
  const level = readLevelDat(buffer);
  const experimentsTag = requireTag(level.root, "experiments", TAG.Compound);
  const experiments = experimentsTag.value;
  const enabledKeys = BETA_API_EXPERIMENT_KEYS.filter((name) =>
    experiments.has(name),
  );

  if (enabledKeys.length > 1) {
    throw new Error(
      "Cannot safely enable Beta APIs: the BDS-generated experiments compound " +
        `contains multiple recognized keys. Observed keys: ${[...experiments.keys()].join(", ") || "(none)"}.`,
    );
  }

  requireTag(level.root, "Generator", TAG.Int);
  requireTag(level.root, "cheatsEnabled", TAG.Byte);
  requireTag(level.root, "commandsEnabled", TAG.Byte);
  requireTag(experiments, "experiments_ever_used", TAG.Byte);
  requireTag(experiments, "saved_with_toggled_experiments", TAG.Byte);

  const experimentKey = enabledKeys[0] ?? "gametest";
  setByte(experiments, experimentKey, true);
  setByte(experiments, "experiments_ever_used", true);
  setByte(experiments, "saved_with_toggled_experiments", true);
  setInt(level.root, "Generator", 2);
  setByte(level.root, "cheatsEnabled", true);
  setByte(level.root, "commandsEnabled", true);

  return {
    buffer: writeLevelDat(level),
    experimentKey,
    generator: tagValue(level.root, "Generator"),
  };
}
