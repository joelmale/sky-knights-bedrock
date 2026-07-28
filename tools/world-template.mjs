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

// A fixed entry timestamp. Without one, fflate stamps every entry with the
// current time, so two packagings of identical content produced different
// archive hashes and the SHA-256 recorded as evidence proved only which run
// wrote the file.
//
// ZIP stores local time and only spans 1980-2099, so this sits mid-range
// (1995-01-01Z) rather than on the DOS epoch, where a negative UTC offset
// pushes the date out of range and fflate throws.
const FIXED_ARCHIVE_MTIME = 788_918_400_000;

export function archiveFromEntries(entries) {
  const ordered = {};
  for (const key of Object.keys(entries).sort()) {
    ordered[key] = entries[key];
  }
  return zipSync(ordered, { mtime: FIXED_ARCHIVE_MTIME });
}

/**
 * The template manifest contract.
 *
 * `expectedVersion` is the caller's packaged version, read from `package.json`
 * rather than restated here — a hard-coded literal turned every version bump
 * into a packaging failure discovered only at build time.
 */
export function validateTemplateManifest(manifest, expectedVersion) {
  const module = manifest?.modules?.[0];
  const version = JSON.stringify(expectedVersion);

  if (!Array.isArray(expectedVersion) || expectedVersion.length !== 3) {
    throw new Error(
      "validateTemplateManifest requires a three-part expected version.",
    );
  }

  return (
    manifest?.format_version === 2 &&
    UUID.test(manifest?.header?.uuid ?? "") &&
    JSON.stringify(manifest?.header?.version) === version &&
    JSON.stringify(manifest?.header?.base_game_version) === "[1,26,30]" &&
    manifest?.header?.lock_template_options === true &&
    Array.isArray(manifest?.modules) &&
    manifest.modules.length === 1 &&
    module?.type === "world_template" &&
    UUID.test(module?.uuid ?? "") &&
    module.uuid !== manifest.header.uuid &&
    JSON.stringify(module?.version) === version
  );
}
