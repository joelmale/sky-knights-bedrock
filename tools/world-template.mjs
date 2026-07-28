import { zipSync } from "fflate";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function validPackManifest(manifest) {
  return (
    UUID.test(manifest?.header?.uuid ?? "") &&
    Array.isArray(manifest?.header?.version) &&
    manifest.header.version.length === 3 &&
    manifest.header.version.every(
      (value) => Number.isInteger(value) && value >= 0,
    )
  );
}

export function packReferences(behaviorManifest, resourceManifest) {
  if (
    !validPackManifest(behaviorManifest) ||
    !validPackManifest(resourceManifest)
  ) {
    throw new Error(
      "Embedded pack manifests require a header UUID and version.",
    );
  }

  return {
    behavior: [
      {
        pack_id: behaviorManifest.header.uuid,
        version: behaviorManifest.header.version,
      },
    ],
    resource: [
      {
        pack_id: resourceManifest.header.uuid,
        version: resourceManifest.header.version,
      },
    ],
  };
}

export function archiveFromEntries(entries) {
  const ordered = {};
  for (const key of Object.keys(entries).sort()) {
    ordered[key] = entries[key];
  }
  return zipSync(ordered);
}

export function validateTemplateManifest(manifest) {
  const module = manifest?.modules?.[0];
  return (
    manifest?.format_version === 2 &&
    UUID.test(manifest?.header?.uuid ?? "") &&
    JSON.stringify(manifest?.header?.version) === "[0,3,5]" &&
    JSON.stringify(manifest?.header?.base_game_version) === "[1,26,30]" &&
    manifest?.header?.lock_template_options === true &&
    Array.isArray(manifest?.modules) &&
    manifest.modules.length === 1 &&
    module?.type === "world_template" &&
    UUID.test(module?.uuid ?? "") &&
    module.uuid !== manifest.header.uuid &&
    JSON.stringify(module?.version) === "[0,3,5]"
  );
}
