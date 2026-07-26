import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import { zipSync } from "fflate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const profiles = {
  experimental: {
    source: path.join(root, "profiles", "experimental", "behavior_pack"),
    entry: path.join(root, "profiles", "experimental", "scripts", "main.ts"),
    deploymentName: "sky_knights_experimental",
    includeStarterIsland: true,
  },
  gametest: {
    source: path.join(root, "profiles", "gametest", "behavior_pack"),
    entry: path.join(root, "profiles", "gametest", "scripts", "main.ts"),
    deploymentName: "sky_knights_gametest",
    includeStarterIsland: false,
  },
};

const args = process.argv.slice(2);
const requestedProfile = valueAfter(args, "--profile");
const deploy = args.includes("--deploy");
const names = args.includes("--all")
  ? Object.keys(profiles)
  : requestedProfile
    ? [requestedProfile]
    : [];

if (names.length === 0 || names.some((name) => !(name in profiles))) {
  throw new Error("Use --all or --profile experimental|gametest.");
}

for (const name of names) {
  await buildProfile(name, profiles[name], deploy);
}

async function buildProfile(name, profile, shouldDeploy) {
  const outputRoot = path.join(root, "dist", "profiles");
  const packOutput = path.join(outputRoot, profile.deploymentName);
  const scriptsOutput = path.join(packOutput, "scripts");

  await rm(packOutput, { recursive: true, force: true });
  await mkdir(scriptsOutput, { recursive: true });
  await cp(profile.source, packOutput, { recursive: true });

  if (profile.includeStarterIsland) {
    const sharedStructure = path.join(
      root,
      "behavior_packs",
      "sk_bp",
      "structures",
      "skyknights",
      "starter_island.mcstructure",
    );
    const structureTarget = path.join(
      packOutput,
      "structures",
      "skyknights",
      "starter_island.mcstructure",
    );
    await mkdir(path.dirname(structureTarget), { recursive: true });
    await cp(sharedStructure, structureTarget);
  }

  await build({
    entryPoints: [profile.entry],
    outfile: path.join(scriptsOutput, "main.js"),
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es6",
    external: ["@minecraft/server", "@minecraft/server-gametest"],
    sourcemap: true,
    logLevel: "warning",
  });

  await mkdir(outputRoot, { recursive: true });
  const archivePath = path.join(outputRoot, `${profile.deploymentName}.mcpack`);
  await writeFile(archivePath, zipSync(await zipEntries(packOutput)));

  if (shouldDeploy) {
    await deployProfile(packOutput, profile.deploymentName);
  }

  process.stdout.write(
    `Built ${name} profile: ${path.relative(root, archivePath)}\n`,
  );
}

async function deployProfile(packOutput, deploymentName) {
  const environment = await readEnvironment(path.join(root, ".env"));
  const customPath = environment.CUSTOM_DEPLOYMENT_PATH;
  const appData = process.env.APPDATA;

  if (!customPath && !appData) {
    throw new Error(
      "APPDATA is unavailable; set CUSTOM_DEPLOYMENT_PATH in .env.",
    );
  }

  const deploymentRoot =
    customPath ||
    path.join(
      appData,
      "Minecraft Bedrock",
      "Users",
      "Shared",
      "games",
      "com.mojang",
    );
  const behaviorPacksRoot = path.resolve(
    deploymentRoot,
    "development_behavior_packs",
  );
  const target = path.resolve(behaviorPacksRoot, deploymentName);

  if (!target.startsWith(`${behaviorPacksRoot}${path.sep}`)) {
    throw new Error(`Unsafe deployment target: ${target}`);
  }

  await rm(target, { recursive: true, force: true });
  await mkdir(behaviorPacksRoot, { recursive: true });
  await cp(packOutput, target, { recursive: true });
  process.stdout.write(`Deployed ${deploymentName}: ${target}\n`);
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

async function readEnvironment(filePath) {
  const values = {};
  const contents = await readFile(filePath, "utf8");

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator < 1) {
      continue;
    }

    values[line.slice(0, separator)] = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/gu, "");
  }

  return values;
}

function valueAfter(argumentsList, flag) {
  const index = argumentsList.indexOf(flag);
  return index >= 0 ? argumentsList[index + 1] : undefined;
}
