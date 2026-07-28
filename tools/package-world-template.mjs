import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  archiveFromEntries,
  packReferences,
  validateTemplateManifest,
  validPackManifest,
} from "./world-template.mjs";
import {
  inspectVoidLevelDat,
  VOID_SOURCE_METADATA,
} from "./bds/void-level-dat.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function packageWorldTemplate({
  rootDirectory = root,
  sourceWorld,
  outputRoot = path.join(rootDirectory, "dist", "world-template"),
}) {
  if (!sourceWorld) {
    throw new Error("Provide a Bedrock world folder.");
  }

  const source = path.resolve(sourceWorld);
  const staging = path.join(outputRoot, "sky_knights_world");
  if (pathsOverlap(source, staging)) {
    throw new Error(
      "The source world cannot overlap the template staging folder.",
    );
  }

  await requireFile(
    path.join(source, "level.dat"),
    "Not a Bedrock world folder",
  );
  await requireDirectory(
    path.join(source, "db"),
    "Not a complete Bedrock world folder",
  );
  await requireFile(
    path.join(source, "level.dat_old"),
    "Bedrock source world is not cleanly finalized",
  );
  await requireFile(
    path.join(source, "levelname.txt"),
    "Bedrock source world is missing its name",
  );
  await rejectPath(
    path.join(source, "session.lock"),
    "Refusing to package a live or uncleanly closed Bedrock world",
  );
  await assertNoSymbolicLinks(source);
  inspectVoidLevelDat(await readFile(path.join(source, "level.dat")));
  inspectVoidLevelDat(await readFile(path.join(source, "level.dat_old")));
  const levelName = (
    await readFile(path.join(source, "levelname.txt"), "utf8")
  ).trim();
  if (levelName !== VOID_SOURCE_METADATA.levelName) {
    throw new Error(
      `Void source levelname.txt must be "${VOID_SOURCE_METADATA.levelName}"; found "${levelName}".`,
    );
  }
  await rm(staging, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  await cp(source, staging, { recursive: true });
  for (const stale of [
    "behavior_packs",
    "resource_packs",
    "world_behavior_packs.json",
    "world_resource_packs.json",
    "world_behavior_pack_history.json",
    "world_resource_pack_history.json",
  ]) {
    await rm(path.join(staging, stale), { recursive: true, force: true });
  }

  const behaviorManifest = await readJson(
    path.join(rootDirectory, "behavior_packs", "sk_bp", "manifest.json"),
  );
  const resourceManifest = await readJson(
    path.join(rootDirectory, "resource_packs", "sk_rp", "manifest.json"),
  );
  const manifest = await readJson(
    path.join(rootDirectory, "world_templates", "manifest.json"),
  );
  if (
    !validateTemplateManifest(manifest) ||
    !validPackManifest(behaviorManifest) ||
    !validPackManifest(resourceManifest)
  ) {
    throw new Error("Template or embedded pack manifest contract failed.");
  }
  const uuids = [
    manifest.header.uuid,
    manifest.modules[0].uuid,
    behaviorManifest.header.uuid,
    resourceManifest.header.uuid,
  ];
  if (new Set(uuids).size !== uuids.length) {
    throw new Error("Template and embedded pack UUIDs must be distinct.");
  }

  await cp(
    path.join(rootDirectory, "behavior_packs", "sk_bp"),
    path.join(staging, "behavior_packs", "sk_bp"),
    { recursive: true },
  );
  await mkdir(path.join(staging, "behavior_packs", "sk_bp", "scripts"), {
    recursive: true,
  });
  await cp(
    path.join(rootDirectory, "dist", "scripts"),
    path.join(staging, "behavior_packs", "sk_bp", "scripts"),
    { recursive: true },
  );
  await cp(
    path.join(rootDirectory, "resource_packs", "sk_rp"),
    path.join(staging, "resource_packs", "sk_rp"),
    { recursive: true },
  );
  await cp(
    path.join(rootDirectory, "world_templates", "manifest.json"),
    path.join(staging, "manifest.json"),
  );
  await cp(
    path.join(rootDirectory, "world_templates", "texts"),
    path.join(staging, "texts"),
    { recursive: true },
  );
  const refs = packReferences(behaviorManifest, resourceManifest);
  await writeJson(
    path.join(staging, "world_behavior_packs.json"),
    refs.behavior,
  );
  await writeJson(
    path.join(staging, "world_resource_packs.json"),
    refs.resource,
  );

  const templatePath = path.join(
    outputRoot,
    "sky_knights_void_world.mctemplate",
  );
  await writeFile(templatePath, archiveFromEntries(await zipEntries(staging)));
  return { templatePath, staging };
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  const sourceWorld =
    valueAfter(args, "--world") || process.env.SKY_KNIGHTS_WORLD_SOURCE;
  const result = await packageWorldTemplate({ sourceWorld });
  process.stdout.write(`Built world template: ${result.templatePath}\n`);
}

function pathsOverlap(left, right) {
  return isWithin(left, right) || isWithin(right, left);
}

function isWithin(child, parent) {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

async function requireFile(filePath, message) {
  try {
    if (!(await stat(filePath)).isFile()) throw new Error();
  } catch {
    throw new Error(`${message}: ${filePath}`);
  }
}

async function requireDirectory(filePath, message) {
  try {
    if (!(await stat(filePath)).isDirectory()) throw new Error();
  } catch {
    throw new Error(`${message}: ${filePath}`);
  }
}

async function rejectPath(filePath, message) {
  try {
    await stat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`${message}: ${filePath}`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function assertNoSymbolicLinks(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(
        `World-template sources cannot contain symbolic links: ${entryPath}`,
      );
    }
    if (entry.isDirectory()) {
      await assertNoSymbolicLinks(entryPath);
    }
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, undefined, 2)}\n`);
}

async function zipEntries(directory, prefix = "") {
  const result = {};
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  );
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const archivePath = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(
        `World-template archives cannot contain symbolic links: ${fullPath}`,
      );
    }
    if (entry.isDirectory()) {
      Object.assign(result, await zipEntries(fullPath, archivePath));
    } else {
      result[archivePath] = new Uint8Array(await readFile(fullPath));
    }
  }
  return result;
}

function valueAfter(argumentsList, flag) {
  const index = argumentsList.indexOf(flag);
  return index >= 0 ? argumentsList[index + 1] : undefined;
}
