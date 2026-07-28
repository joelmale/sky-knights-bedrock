import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import {
  cp,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  inspectVoidLevelDat,
  patchVoidLevelDat,
  VOID_SOURCE_METADATA,
} from "./void-level-dat.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const SOURCE_WORLD_NAME = "sky_knights_bds_void_source";
const VALIDATION_WORLD_NAME = "sky_knights_bds_void_validation";
const VALIDATION_PACK_NAME = "sky_knights_bds_void_validation";
const SENTINEL_NAME = ".sky-knights-bds-test-root";
const SENTINEL_VALUE = "sky-knights-bds-test-root-v1\n";
const LOCK_NAME = ".sky-knights-bds-void-source.lock";
const SHARED_LOCK_NAME = ".sky-knights-bds-smoke.lock";
const PROPERTIES_BACKUP_NAME = ".sky-knights-bds-void-server.properties.backup";
const ARTIFACTS_NAME = "sky_knights_bds_void_artifacts";
const SUPPORTED_BDS_VERSION = "1.26.34.3";
const MARKER_PREFIX = "SKY_KNIGHTS_VOID_VALIDATION ";
const START_TIMEOUT_MS = 45_000;
const STOP_TIMEOUT_MS = 20_000;
const VALIDATION_TIMEOUT_MS = 180_000;
const PORTS = {
  ipv4: 19154,
  ipv6: 19155,
};

const PHASE_TICKING_AREAS = {
  1: [
    {
      name: "sk_void_p1_origin",
      from: [-16, 0, -16],
      to: [31, 0, 31],
    },
    {
      name: "sk_void_p1_east",
      from: [2048, 0, 0],
      to: [2063, 0, 15],
    },
    {
      name: "sk_void_p1_west",
      from: [-2048, 0, 0],
      to: [-2033, 0, 15],
    },
    {
      name: "sk_void_p1_south",
      from: [0, 0, 2048],
      to: [15, 0, 2063],
    },
    {
      name: "sk_void_p1_north",
      from: [0, 0, -2048],
      to: [15, 0, -2033],
    },
  ],
  2: [
    {
      name: "sk_void_p2_se",
      from: [4096, 0, 4096],
      to: [4111, 0, 4111],
    },
    {
      name: "sk_void_p2_sw",
      from: [-4096, 0, 4096],
      to: [-4081, 0, 4111],
    },
    {
      name: "sk_void_p2_ne",
      from: [4096, 0, -4096],
      to: [4111, 0, -4081],
    },
    {
      name: "sk_void_p2_nw",
      from: [-4096, 0, -4096],
      to: [-4081, 0, -4081],
    },
  ],
};

let activeSession;
let interrupted = false;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    interrupted = true;
    void activeSession?.stop(`received ${signal}`);
  });
}

async function main() {
  const bdsRoot = await resolveBdsRoot();
  const paths = await runnerPaths(bdsRoot);
  const locks = await acquireLocks(paths);
  let originalProperties;
  let artifactDirectory;
  let failure;
  let processStopped = true;
  let frozenStagingCreated = false;

  try {
    await recoverInterruptedProperties(paths);
    await prepareFrozenTarget(paths);
    artifactDirectory = await createArtifactDirectory(
      paths.root,
      paths.artifacts,
    );
    originalProperties = await readFile(paths.properties, "utf8");
    await writeFile(
      path.join(artifactDirectory, "server.properties.before"),
      originalProperties,
    );
    await writeFile(paths.propertiesBackup, originalProperties, {
      flag: "wx",
    });
    await writeRunMetadata(paths, artifactDirectory);

    for (const target of [
      paths.sourceWorld,
      paths.validationWorld,
      paths.validationPack,
    ]) {
      await removeOwnedDirectory(paths.root, target);
    }

    await atomicWrite(
      paths.properties,
      voidServerProperties(originalProperties, SOURCE_WORLD_NAME),
    );
    await bootstrapSourceWorld(paths, artifactDirectory);
    await patchAndResetSourceWorld(paths, artifactDirectory);
    await bootVoidSource(paths, artifactDirectory);

    await cp(paths.sourceWorld, paths.frozenStaging, { recursive: true });
    frozenStagingCreated = true;
    await assertNoSessionLock(paths.frozenStaging, "frozen source staging");
    const sourceHash = await hashDirectory(paths.frozenStaging);
    await writeJson(
      path.join(artifactDirectory, "source-tree-hash.json"),
      sourceHash,
    );

    await stageValidationPack(paths, artifactDirectory);
    await cp(paths.frozenStaging, paths.validationWorld, {
      recursive: true,
    });
    await activateValidationPack(paths);
    await atomicWrite(
      paths.properties,
      voidServerProperties(originalProperties, VALIDATION_WORLD_NAME),
    );

    const phaseOne = await runValidationPhase(paths, artifactDirectory, 1);
    const phaseTwo = await runValidationPhase(paths, artifactDirectory, 2);
    const sourceHashAfterValidation = await hashDirectory(paths.frozenStaging);

    if (sourceHashAfterValidation.sha256 !== sourceHash.sha256) {
      throw new Error(
        "Frozen source staging changed while its separate validation copy was running.",
      );
    }

    await verifyPersistedVoidMetadata(paths.validationWorld, {
      requireClientMetadata: false,
    });
    await publishFrozenSource(paths);
    frozenStagingCreated = false;
    await writeJson(path.join(artifactDirectory, "result.json"), {
      status: "passed",
      bdsVersion: SUPPORTED_BDS_VERSION,
      frozenSource: paths.frozenSource,
      sourceSha256: sourceHash.sha256,
      clientMetadata: VOID_SOURCE_METADATA,
      experimentsEnabled: false,
      excludedTransientFiles: ["session.lock"],
      phases: [phaseOne, phaseTwo],
    });
    process.stdout.write(`Frozen void source: ${paths.frozenSource}\n`);
    process.stdout.write(
      `BDS void validation artifacts: ${artifactDirectory}\n`,
    );
  } catch (error) {
    failure = error;

    if (artifactDirectory !== undefined) {
      await writeJson(path.join(artifactDirectory, "result.json"), {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => undefined);
    }
  } finally {
    const cleanupErrors = [];

    try {
      await activeSession?.stop("void-source runner cleanup");
    } catch (error) {
      processStopped = activeSession?.exited === true;
      cleanupErrors.push(error);
    }
    activeSession = undefined;

    if (originalProperties !== undefined && processStopped) {
      try {
        await atomicWrite(paths.properties, originalProperties);
        await rm(paths.propertiesBackup, { force: true });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }

    if (processStopped) {
      for (const target of [
        paths.sourceWorld,
        paths.validationWorld,
        paths.validationPack,
      ]) {
        try {
          await removeOwnedDirectory(paths.root, target);
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
    }

    if (frozenStagingCreated) {
      try {
        await removeFrozenStaging(paths);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }

    for (const lock of locks) {
      try {
        await lock.handle.close();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }

    if (processStopped) {
      for (const lock of locks) {
        try {
          await rm(lock.path, { force: true });
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
    }

    if (cleanupErrors.length > 0) {
      failure = new AggregateError(
        failure === undefined ? cleanupErrors : [failure, ...cleanupErrors],
        "BDS void-source execution or cleanup failed.",
      );
    }
  }

  if (failure !== undefined) {
    throw failure;
  }
}

async function resolveBdsRoot() {
  const environment = await readEnvironment(path.join(root, ".env"));
  const configured =
    process.env.SKY_KNIGHTS_BDS_ROOT ?? environment.SKY_KNIGHTS_BDS_ROOT;

  if (configured === undefined || configured.trim() === "") {
    throw new Error(
      "SKY_KNIGHTS_BDS_ROOT is required and must point to a dedicated test-only BDS root.",
    );
  }

  const resolved = await realpath(configured);

  if (path.parse(resolved).root === resolved) {
    throw new Error("SKY_KNIGHTS_BDS_ROOT must not be a filesystem root.");
  }

  const resolvedRepository = await realpath(root);

  if (
    resolved === resolvedRepository ||
    isDescendant(resolvedRepository, resolved) ||
    isDescendant(resolved, resolvedRepository)
  ) {
    throw new Error(
      "SKY_KNIGHTS_BDS_ROOT must not overlap the repository root.",
    );
  }

  if (process.env.USERPROFILE !== undefined) {
    const resolvedProfile = await realpath(process.env.USERPROFILE).catch(() =>
      path.resolve(process.env.USERPROFILE),
    );

    if (resolved === resolvedProfile) {
      throw new Error(
        "SKY_KNIGHTS_BDS_ROOT must not be the user-profile root.",
      );
    }
  }

  const sentinel = path.join(resolved, SENTINEL_NAME);
  const sentinelValue = await readFile(sentinel, "utf8").catch(() => undefined);

  if (sentinelValue !== SENTINEL_VALUE) {
    throw new Error(
      `Refusing to modify ${resolved}. ${SENTINEL_NAME} must contain ${JSON.stringify(SENTINEL_VALUE)}.`,
    );
  }

  const executable = path.join(resolved, "bedrock_server.exe");
  const executableStats = await lstat(executable).catch(() => {
    throw new Error(`BDS executable is missing: ${executable}`);
  });

  if (!executableStats.isFile() || executableStats.isSymbolicLink()) {
    throw new Error(`BDS executable is not a safe file: ${executable}`);
  }

  return resolved;
}

async function runnerPaths(bdsRoot) {
  const frozenOutputRoot = path.join(root, "dist", "world-template");
  const paths = {
    root: bdsRoot,
    executable: path.join(bdsRoot, "bedrock_server.exe"),
    properties: path.join(bdsRoot, "server.properties"),
    worlds: path.join(bdsRoot, "worlds"),
    behaviorPacks: path.join(bdsRoot, "behavior_packs"),
    sourceWorld: path.join(bdsRoot, "worlds", SOURCE_WORLD_NAME),
    sourceDb: path.join(bdsRoot, "worlds", SOURCE_WORLD_NAME, "db"),
    validationWorld: path.join(bdsRoot, "worlds", VALIDATION_WORLD_NAME),
    validationPack: path.join(bdsRoot, "behavior_packs", VALIDATION_PACK_NAME),
    validationPackSource: path.join(
      root,
      "profiles",
      "void_validation",
      "behavior_pack",
    ),
    artifacts: path.join(bdsRoot, ARTIFACTS_NAME),
    lock: path.join(bdsRoot, LOCK_NAME),
    sharedLock: path.join(bdsRoot, SHARED_LOCK_NAME),
    propertiesBackup: path.join(bdsRoot, PROPERTIES_BACKUP_NAME),
    frozenOutputRoot,
    frozenStaging: path.join(frozenOutputRoot, ".void-source-next"),
    frozenBackup: path.join(frozenOutputRoot, ".void-source-previous"),
    frozenSource: path.join(frozenOutputRoot, "source"),
  };

  for (const [name, candidate] of Object.entries(paths)) {
    if (
      [
        "root",
        "executable",
        "properties",
        "validationPackSource",
        "frozenOutputRoot",
        "frozenStaging",
        "frozenBackup",
        "frozenSource",
      ].includes(name)
    ) {
      continue;
    }
    assertOwnedPath(bdsRoot, candidate, name);
  }

  const configuration = await lstat(paths.properties).catch(() => undefined);

  if (!configuration?.isFile() || configuration.isSymbolicLink()) {
    throw new Error(
      `BDS configuration is missing or unsafe: ${paths.properties}`,
    );
  }

  for (const directory of [paths.worlds, paths.behaviorPacks]) {
    const details = await lstat(directory).catch(() => undefined);

    if (!details?.isDirectory() || details.isSymbolicLink()) {
      throw new Error(`BDS directory is missing or unsafe: ${directory}`);
    }
  }

  const profileManifest = await lstat(
    path.join(paths.validationPackSource, "manifest.json"),
  ).catch(() => undefined);

  if (!profileManifest?.isFile() || profileManifest.isSymbolicLink()) {
    throw new Error(
      `Void validation profile is missing: ${paths.validationPackSource}`,
    );
  }

  return paths;
}

function assertOwnedPath(bdsRoot, candidate, label) {
  const relative = path.relative(bdsRoot, candidate);

  if (
    relative === "" ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`Unsafe ${label} path: ${candidate}`);
  }
}

function isDescendant(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative.length > 0 &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

async function prepareFrozenTarget(paths) {
  await mkdir(paths.frozenOutputRoot, { recursive: true });
  const sourceExists = await pathExists(paths.frozenSource);
  const backupExists = await pathExists(paths.frozenBackup);

  if (sourceExists) {
    await assertFrozenDirectory(paths, paths.frozenSource, "source");
  }

  if (backupExists && !sourceExists) {
    await assertFrozenDirectory(
      paths,
      paths.frozenBackup,
      ".void-source-previous",
    );
    await rename(paths.frozenBackup, paths.frozenSource);
  } else if (backupExists) {
    await removeFrozenDirectory(
      paths,
      paths.frozenBackup,
      ".void-source-previous",
    );
  }

  if (await pathExists(paths.frozenStaging)) {
    await removeFrozenDirectory(
      paths,
      paths.frozenStaging,
      ".void-source-next",
    );
  }
}

async function publishFrozenSource(paths) {
  const sourceExists = await pathExists(paths.frozenSource);

  if (sourceExists) {
    await assertFrozenDirectory(paths, paths.frozenSource, "source");
    await rename(paths.frozenSource, paths.frozenBackup);
  }

  try {
    await rename(paths.frozenStaging, paths.frozenSource);
  } catch (error) {
    if (
      !(await pathExists(paths.frozenSource)) &&
      (await pathExists(paths.frozenBackup))
    ) {
      try {
        await rename(paths.frozenBackup, paths.frozenSource);
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          "Unable to publish the new frozen source or restore the previous source.",
        );
      }
    }
    throw error;
  }

  if (await pathExists(paths.frozenBackup)) {
    await removeFrozenDirectory(
      paths,
      paths.frozenBackup,
      ".void-source-previous",
    );
  }
}

async function pathExists(candidate) {
  return (
    (await lstat(candidate).catch((error) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return undefined;
      }
      throw error;
    })) !== undefined
  );
}

async function recoverInterruptedProperties(paths) {
  const backup = await lstat(paths.propertiesBackup).catch((error) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  });

  if (backup === undefined) {
    return;
  }

  if (!backup.isFile() || backup.isSymbolicLink()) {
    throw new Error(
      `Refusing unsafe server.properties backup: ${paths.propertiesBackup}`,
    );
  }

  await atomicWrite(
    paths.properties,
    await readFile(paths.propertiesBackup, "utf8"),
  );
  await rm(paths.propertiesBackup);
  process.stdout.write(
    "Restored server.properties from an interrupted BDS void-source run.\n",
  );
}

async function atomicWrite(filePath, contents) {
  const temporary = `${filePath}.sky-knights-${process.pid}-${randomUUID()}.tmp`;
  let created = false;

  try {
    await writeFile(temporary, contents, { flag: "wx" });
    created = true;
    await rename(temporary, filePath);
  } catch (error) {
    if (created) {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
    throw error;
  }
}

async function acquireLocks(paths) {
  const locks = [];

  try {
    locks.push({
      path: paths.sharedLock,
      handle: await acquireLock(paths.sharedLock, "shared BDS"),
    });
    locks.push({
      path: paths.lock,
      handle: await acquireLock(paths.lock, "void-source"),
    });
    return locks;
  } catch (error) {
    for (const lock of locks) {
      await lock.handle.close().catch(() => undefined);
      await rm(lock.path, { force: true }).catch(() => undefined);
    }
    throw error;
  }
}

async function acquireLock(lockPath, label) {
  try {
    const lock = await open(lockPath, "wx");
    await lock.writeFile(
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    );
    return lock;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(`BDS ${label} lock already exists: ${lockPath}`);
    }
    throw error;
  }
}

async function createArtifactDirectory(bdsRoot, artifactsRoot) {
  assertOwnedPath(bdsRoot, artifactsRoot, "artifact root");
  const existing = await lstat(artifactsRoot).catch((error) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  });

  if (existing?.isSymbolicLink()) {
    throw new Error(`Refusing artifact reparse target: ${artifactsRoot}`);
  }

  if (existing !== undefined && !existing.isDirectory()) {
    throw new Error(`BDS artifact root is not a directory: ${artifactsRoot}`);
  }

  if (existing === undefined) {
    await mkdir(artifactsRoot);
  }

  const name = new Date().toISOString().replace(/[:.]/gu, "-");
  const directory = path.join(artifactsRoot, name);
  await mkdir(directory, { recursive: false });
  return directory;
}

async function writeRunMetadata(paths, artifacts) {
  const manifest = JSON.parse(
    await readFile(
      path.join(paths.validationPackSource, "manifest.json"),
      "utf8",
    ),
  );
  const commit = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  const status = spawnSync("git", ["status", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });

  if (commit.status !== 0 || status.status !== 0) {
    throw new Error("Unable to record the Git checkpoint for BDS artifacts.");
  }

  await writeJson(path.join(artifacts, "run-metadata.json"), {
    command: "node tools/bds/run-void-source.mjs",
    gitCommit: commit.stdout.trim(),
    gitDirty: status.stdout.trim().length > 0,
    approvedBdsVersion: SUPPORTED_BDS_VERSION,
    sourceWorldName: SOURCE_WORLD_NAME,
    validationWorldName: VALIDATION_WORLD_NAME,
    clientMetadata: VOID_SOURCE_METADATA,
    experimentsEnabled: false,
    excludedTransientFiles: ["session.lock"],
    ports: PORTS,
    validationManifest: manifest,
  });
  await writeJson(path.join(artifacts, "manifest.validation.json"), manifest);
}

async function removeOwnedDirectory(bdsRoot, directory) {
  assertOwnedPath(bdsRoot, directory, "runner-owned directory");
  const details = await lstat(directory).catch((error) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  });

  if (details === undefined) {
    return;
  }

  if (details.isSymbolicLink()) {
    throw new Error(`Refusing runner-owned reparse target: ${directory}`);
  }

  const resolved = await realpath(directory);

  if (!isDescendant(bdsRoot, resolved)) {
    throw new Error(`Runner-owned directory resolves outside BDS: ${resolved}`);
  }

  await rm(directory, { recursive: true, force: true });
}

async function removeFrozenStaging(paths) {
  if (!(await pathExists(paths.frozenStaging))) {
    return;
  }

  await removeFrozenDirectory(paths, paths.frozenStaging, ".void-source-next");
}

async function assertFrozenDirectory(paths, candidate, expectedName) {
  if (
    path.dirname(candidate) !== paths.frozenOutputRoot ||
    path.basename(candidate) !== expectedName
  ) {
    throw new Error(`Unsafe frozen-source path: ${candidate}`);
  }

  const details = await lstat(candidate);

  if (!details.isDirectory() || details.isSymbolicLink()) {
    throw new Error(`Unsafe frozen-source directory: ${candidate}`);
  }
}

async function removeFrozenDirectory(paths, candidate, expectedName) {
  await assertFrozenDirectory(paths, candidate, expectedName);
  await rm(candidate, { recursive: true, force: true });
}

function voidServerProperties(original, worldName) {
  const values = {
    "server-name": "Sky Knights BDS Void Source",
    "level-name": worldName,
    "level-seed": String(VOID_SOURCE_METADATA.randomSeed),
    gamemode: "survival",
    "force-gamemode": "true",
    "allow-cheats": "true",
    "online-mode": "true",
    "allow-list": "true",
    "server-port": String(PORTS.ipv4),
    "server-portv6": String(PORTS.ipv6),
    "enable-lan-visibility": "false",
    "default-player-permission-level": "operator",
    "content-log-file-enabled": "true",
    "content-log-console-output-enabled": "true",
    "content-log-level": "verbose",
    "view-distance": "5",
    "tick-distance": "4",
  };
  let output = original;

  for (const [key, value] of Object.entries(values)) {
    const line = new RegExp(`^${escapeRegExp(key)}=.*$`, "mu");
    output = line.test(output)
      ? output.replace(line, `${key}=${value}`)
      : `${output.trimEnd()}\n${key}=${value}\n`;
  }

  return output;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

async function bootstrapSourceWorld(paths, artifacts) {
  const session = launchServer(paths, path.join(artifacts, "boot-a.log"));
  activeSession = session;
  await session.waitFor(
    /Server started/iu,
    START_TIMEOUT_MS,
    "void bootstrap startup",
  );
  const version = requireServerVersion(session.output);
  await writeJson(path.join(artifacts, "boot-a.json"), {
    bdsVersion: version,
  });
  await session.stop("void bootstrap world created");
  activeSession = undefined;

  await writeJson(
    path.join(artifacts, "bootstrap-world-hash.json"),
    await hashDirectory(paths.sourceWorld),
  );
}

async function patchAndResetSourceWorld(paths, artifacts) {
  const levelPath = path.join(paths.sourceWorld, "level.dat");
  const oldPath = path.join(paths.sourceWorld, "level.dat_old");
  const original = await readFile(levelPath).catch(() => {
    throw new Error(`BDS did not create the expected level.dat: ${levelPath}`);
  });
  const originalOld = await readFile(oldPath).catch(() => undefined);
  const patched = patchVoidLevelDat(original);
  const patchedOld =
    originalOld === undefined ? patched : patchVoidLevelDat(originalOld);

  await writeFile(path.join(artifacts, "level.dat.bootstrap"), original);

  if (originalOld !== undefined) {
    await writeFile(
      path.join(artifacts, "level.dat_old.bootstrap"),
      originalOld,
    );
  }

  await atomicWrite(levelPath, patched);
  await atomicWrite(oldPath, patchedOld);
  await writeFile(path.join(artifacts, "level.dat.patched"), patched);
  await writeFile(path.join(artifacts, "level.dat_old.patched"), patchedOld);
  await writeJson(path.join(artifacts, "void-tags.patched.json"), {
    levelDat: inspectVoidLevelDat(patched),
    levelDatOld: inspectVoidLevelDat(patchedOld),
  });

  await removeOwnedDirectory(paths.root, paths.sourceDb);
}

async function bootVoidSource(paths, artifacts) {
  const session = launchServer(paths, path.join(artifacts, "boot-b.log"));
  activeSession = session;
  await session.waitFor(
    /Server started/iu,
    START_TIMEOUT_MS,
    "void source startup",
  );
  const version = requireServerVersion(session.output);
  assertNoContentErrors(session.output, "void source startup");
  await session.stop("void source saved");
  activeSession = undefined;

  const metadata = await finalizeVoidSourceMetadata(paths.sourceWorld);
  await removeSessionLock(paths.sourceWorld);
  await assertNoSessionLock(paths.sourceWorld, "finalized source world");
  await writeFile(
    path.join(artifacts, "level.dat.source"),
    await readFile(path.join(paths.sourceWorld, "level.dat")),
  );
  await writeFile(
    path.join(artifacts, "level.dat_old.source"),
    await readFile(path.join(paths.sourceWorld, "level.dat_old")),
  );
  await writeJson(path.join(artifacts, "void-tags.source.json"), {
    bdsVersion: version,
    ...metadata,
  });
}

async function finalizeVoidSourceMetadata(worldPath) {
  const levelPath = path.join(worldPath, "level.dat");
  const oldPath = path.join(worldPath, "level.dat_old");
  const levelDat = await readFile(levelPath);
  const levelDatOld = await readFile(oldPath);

  inspectVoidLevelDat(levelDat, { requireClientMetadata: false });
  inspectVoidLevelDat(levelDatOld, { requireClientMetadata: false });
  const patched = patchVoidLevelDat(levelDat);
  const patchedOld = patchVoidLevelDat(levelDatOld);

  await atomicWrite(levelPath, patched);
  await atomicWrite(oldPath, patchedOld);
  await atomicWrite(
    path.join(worldPath, "levelname.txt"),
    `${VOID_SOURCE_METADATA.levelName}\n`,
  );
  return verifyPersistedVoidMetadata(worldPath);
}

async function verifyPersistedVoidMetadata(
  worldPath,
  { requireClientMetadata = true } = {},
) {
  const levelDat = inspectVoidLevelDat(
    await readFile(path.join(worldPath, "level.dat")),
    { requireClientMetadata },
  );
  const levelDatOld = inspectVoidLevelDat(
    await readFile(path.join(worldPath, "level.dat_old")),
    { requireClientMetadata },
  );
  const levelNameText = await readFile(
    path.join(worldPath, "levelname.txt"),
    "utf8",
  );

  if (
    requireClientMetadata &&
    levelNameText !== `${VOID_SOURCE_METADATA.levelName}\n`
  ) {
    throw new Error(
      `Void source levelname.txt must be ${JSON.stringify(VOID_SOURCE_METADATA.levelName)}.`,
    );
  }

  return {
    levelDat,
    levelDatOld,
    levelNameFile: levelNameText.trimEnd(),
  };
}

async function removeSessionLock(worldPath) {
  const sessionLock = path.join(worldPath, "session.lock");
  const details = await lstat(sessionLock).catch((error) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  });

  if (details === undefined) {
    return;
  }

  if (!details.isFile() || details.isSymbolicLink()) {
    throw new Error(`Refusing unexpected session.lock entry: ${sessionLock}`);
  }

  await rm(sessionLock, { force: true });
}

async function assertNoSessionLock(worldPath, context) {
  if (await pathExists(path.join(worldPath, "session.lock"))) {
    throw new Error(`${context} must not contain session.lock.`);
  }
}

async function stageValidationPack(paths, artifacts) {
  await cp(paths.validationPackSource, paths.validationPack, {
    recursive: true,
  });
  await writeFile(
    path.join(artifacts, "validation-script.js"),
    await readFile(path.join(paths.validationPackSource, "scripts", "main.js")),
  );
}

async function activateValidationPack(paths) {
  const manifest = JSON.parse(
    await readFile(path.join(paths.validationPack, "manifest.json"), "utf8"),
  );
  const { uuid, version } = manifest.header ?? {};

  if (typeof uuid !== "string" || !Array.isArray(version)) {
    throw new Error("Void validation manifest has an invalid header.");
  }

  await writeJson(
    path.join(paths.validationWorld, "world_behavior_packs.json"),
    [{ pack_id: uuid, version }],
  );
}

async function runValidationPhase(paths, artifacts, phase) {
  const logPath = path.join(artifacts, `validation-phase-${phase}.log`);
  const session = launchServer(paths, logPath);
  activeSession = session;
  await session.waitFor(
    /Server started/iu,
    START_TIMEOUT_MS,
    `void validation phase ${phase} startup`,
  );
  requireServerVersion(session.output);
  assertNoContentErrors(
    session.output,
    `void validation phase ${phase} startup`,
  );
  const ready = await waitForValidationMarker(
    session,
    0,
    ({ status, phase: markerPhase }) =>
      status === "ready" && markerPhase === phase,
    START_TIMEOUT_MS,
  );

  if (ready.status !== "ready") {
    throw new Error(`Void validator did not become ready for phase ${phase}.`);
  }

  for (const area of PHASE_TICKING_AREAS[phase]) {
    session.send(tickingAreaAddCommand(area));
  }

  await delay(3_000);
  const markerStart = session.output.length;
  session.send("scriptevent skyknights:void_validate start");
  const result = await waitForValidationMarker(
    session,
    markerStart,
    ({ status, phase: markerPhase }) =>
      markerPhase === phase && ["passed", "failed"].includes(status),
    VALIDATION_TIMEOUT_MS,
  );

  for (const area of PHASE_TICKING_AREAS[phase]) {
    session.send(`tickingarea remove ${area.name}`);
  }

  await delay(500);
  assertNoContentErrors(session.output, `void validation phase ${phase}`);
  await session.stop(`void validation phase ${phase} completed`);
  activeSession = undefined;
  await writeJson(path.join(artifacts, `scan-phase-${phase}.json`), result);

  if (result.status !== "passed") {
    throw new Error(
      `Void validation phase ${phase} failed: ${result.reason ?? "unknown failure"}.`,
    );
  }

  return result;
}

function tickingAreaAddCommand(area) {
  return `tickingarea add ${area.from.join(" ")} ${area.to.join(" ")} ${area.name}`;
}

async function waitForValidationMarker(session, start, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    session.throwIfLogFailed();

    if (interrupted) {
      throw new Error("BDS void-source validation interrupted.");
    }

    const markers = validationMarkers(session.output.slice(start));
    const matching = markers.find(predicate);

    if (matching !== undefined) {
      return matching;
    }

    const failed = markers.find(({ status }) => status === "failed");

    if (failed !== undefined) {
      return failed;
    }

    const fatal = startupFailure(session.output.slice(start));

    if (fatal !== undefined) {
      throw new Error(`BDS void validation failed: ${fatal}`);
    }

    if (session.exited) {
      throw new Error(
        `BDS exited before void validation completed with code ${String(session.exitCode)}.`,
      );
    }

    await delay(100);
  }

  throw new Error("Timed out waiting for BDS void validation marker.");
}

function validationMarkers(output) {
  const result = [];

  for (const line of output.split(/\r?\n/u)) {
    const index = line.indexOf(MARKER_PREFIX);

    if (index < 0) {
      continue;
    }

    try {
      result.push(JSON.parse(line.slice(index + MARKER_PREFIX.length)));
    } catch {
      // An incomplete final log line is retried on the next polling cycle.
    }
  }

  return result;
}

function requireServerVersion(output) {
  const version = output.match(
    /version\s*:\s*([0-9]+\.[0-9]+\.[0-9]+(?:\.[0-9]+)?)/iu,
  )?.[1];

  if (version !== SUPPORTED_BDS_VERSION) {
    throw new Error(
      `BDS ${version ?? "(unreported)"} is not approved for void-source generation; expected ${SUPPORTED_BDS_VERSION}.`,
    );
  }

  return version;
}

async function hashDirectory(directory) {
  const files = [];

  async function visit(current, prefix) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relative = path.posix.join(prefix, entry.name);

      if (entry.isSymbolicLink()) {
        throw new Error(`Refusing to hash source-world link: ${fullPath}`);
      }

      if (entry.isDirectory()) {
        await visit(fullPath, relative);
        continue;
      }

      if (!entry.isFile()) {
        throw new Error(`Unsupported source-world entry: ${fullPath}`);
      }

      const contents = await readFile(fullPath);
      files.push({
        path: relative,
        bytes: contents.length,
        sha256: createHash("sha256").update(contents).digest("hex"),
      });
    }
  }

  await visit(directory, "");
  const aggregate = createHash("sha256");

  for (const file of files) {
    aggregate.update(`${file.path}\0${file.bytes}\0${file.sha256}\n`);
  }

  return {
    sha256: aggregate.digest("hex"),
    fileCount: files.length,
    files,
  };
}

function launchServer(paths, logPath) {
  const child = spawn(paths.executable, [], {
    cwd: paths.root,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const session = {
    child,
    output: "",
    logError: undefined,
    exited: false,
    exitCode: undefined,
    send(command) {
      if (!this.exited) {
        this.child.stdin.write(`${command}\n`);
      }
    },
    async waitFor(pattern, timeoutMs, description) {
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        this.throwIfLogFailed();

        if (interrupted) {
          throw new Error(`BDS ${description} interrupted.`);
        }

        if (pattern.test(this.output)) {
          return;
        }

        const fatal = startupFailure(this.output);

        if (fatal !== undefined) {
          throw new Error(`BDS failed during ${description}: ${fatal}`);
        }

        if (this.exited) {
          throw new Error(
            `BDS exited during ${description} with code ${String(this.exitCode)}.`,
          );
        }

        await delay(100);
      }

      throw new Error(`Timed out waiting for BDS ${description}.`);
    },
    async stop(reason) {
      if (this.exited) {
        this.throwIfLogFailed();
        return;
      }

      this.send("stop");
      const stopped = await waitForExitWithin(this.child, STOP_TIMEOUT_MS);

      if (!stopped) {
        await forceStop(this.child.pid, reason);
        const killed = await waitForExitWithin(this.child, 5_000);

        if (!killed) {
          throw new Error(
            `BDS PID ${String(this.child.pid)} remained alive after forced shutdown (${reason}).`,
          );
        }
      }

      this.throwIfLogFailed();
    },
    throwIfLogFailed() {
      if (this.logError !== undefined) {
        throw new Error(
          `Unable to retain the BDS artifact log: ${String(this.logError)}`,
        );
      }
    },
  };
  const append = (chunk) => {
    const text = chunk.toString();
    session.output += text;

    try {
      appendFileSync(logPath, text);
    } catch (error) {
      session.logError ??= error;
    }
  };

  child.stdout.on("data", append);
  child.stderr.on("data", append);
  child.on("exit", (code) => {
    session.exited = true;
    session.exitCode = code;
  });
  child.on("error", (error) => {
    session.output += `${error.message}\n`;
    session.exited = true;
  });
  return session;
}

function startupFailure(output) {
  const invalidModule = output.match(
    /\[Scripting\][\s\S]{0,200}?requested invalid version[^\r\n]*/iu,
  )?.[0];

  if (invalidModule !== undefined) {
    return invalidModule.replace(/\s+/gu, " ");
  }

  const unsafeAllowlist = output.match(
    /Using an allowlist without online authentication[^\r\n]*/iu,
  )?.[0];

  if (unsafeAllowlist !== undefined) {
    return unsafeAllowlist;
  }

  return contentError(output);
}

function assertNoContentErrors(output, stage) {
  const error = contentError(output);

  if (error !== undefined) {
    throw new Error(`BDS ${stage} reported a content error: ${error}`);
  }
}

function contentError(output) {
  const bdsError = output.match(/\[[^\]\r\n]*\bERROR\][^\r\n]*/iu)?.[0];

  if (bdsError !== undefined) {
    return bdsError;
  }

  return output.match(
    /\[Scripting\][^\r\n]*(?:unhandled|exception|run failed|failed to create context)[^\r\n]*/iu,
  )?.[0];
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, undefined, 2)}\n`);
}

function waitForExitWithin(child, timeoutMs) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve(true);
      return;
    }

    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function forceStop(pid, reason) {
  if (pid === undefined) {
    throw new Error(`Cannot force-stop BDS without a PID (${reason}).`);
  }

  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
      windowsHide: true,
    });

    if (result.status !== 0) {
      throw new Error(`taskkill failed for BDS PID ${pid} (${reason}).`);
    }
    return;
  }

  process.kill(pid, "SIGKILL");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readEnvironment(filePath) {
  const values = {};
  let contents;

  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return values;
    }

    throw error;
  }

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

try {
  await main();
} catch (error) {
  process.stderr.write(
    `BDS void-source generation failed: ${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
}
