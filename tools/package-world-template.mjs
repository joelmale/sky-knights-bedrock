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

import { zipSync } from "fflate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const worldArgument = valueAfter(args, "--world");
const sourceWorld = worldArgument || process.env.SKY_KNIGHTS_WORLD_SOURCE;

if (!sourceWorld) {
  throw new Error(
    "Provide --world <Bedrock world folder> or SKY_KNIGHTS_WORLD_SOURCE.",
  );
}

const source = path.resolve(sourceWorld);
const levelDat = path.join(source, "level.dat");

try {
  if (!(await stat(levelDat)).isFile()) {
    throw new Error("level.dat is not a file.");
  }
} catch {
  throw new Error(`Not a Bedrock world folder: ${source}`);
}

const outputRoot = path.join(root, "dist", "world-template");
const staging = path.join(outputRoot, "sky_knights_world");

if (source === staging || source.startsWith(`${staging}${path.sep}`)) {
  throw new Error("The source world cannot be the template staging folder.");
}

const behaviorPackTarget = path.join(staging, "behavior_packs", "sky_knights");
const resourcePackTarget = path.join(staging, "resource_packs", "sky_knights");

await rm(staging, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await cp(source, staging, { recursive: true });
await cp(path.join(root, "behavior_packs", "sk_bp"), behaviorPackTarget, {
  recursive: true,
});
await mkdir(path.join(behaviorPackTarget, "scripts"), {
  recursive: true,
});
await cp(
  path.join(root, "dist", "scripts"),
  path.join(behaviorPackTarget, "scripts"),
  { recursive: true },
);
await cp(path.join(root, "resource_packs", "sk_rp"), resourcePackTarget, {
  recursive: true,
});

const behaviorManifest = JSON.parse(
  await readFile(
    path.join(root, "behavior_packs", "sk_bp", "manifest.json"),
    "utf8",
  ),
);
const resourceManifest = JSON.parse(
  await readFile(
    path.join(root, "resource_packs", "sk_rp", "manifest.json"),
    "utf8",
  ),
);

await writeJson(path.join(staging, "world_behavior_packs.json"), [
  {
    pack_id: behaviorManifest.header.uuid,
    version: behaviorManifest.header.version,
  },
]);
await writeJson(path.join(staging, "world_resource_packs.json"), [
  {
    pack_id: resourceManifest.header.uuid,
    version: resourceManifest.header.version,
  },
]);

const templatePath = path.join(outputRoot, "sky_knights_void_world.mctemplate");
await writeFile(templatePath, zipSync(await zipEntries(staging)));
process.stdout.write(`Built world template: ${templatePath}\n`);

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, undefined, 2)}\n`);
}

async function zipEntries(directory, prefix = "") {
  const result = {};

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    const archivePath = path.posix.join(prefix, entry.name);

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
