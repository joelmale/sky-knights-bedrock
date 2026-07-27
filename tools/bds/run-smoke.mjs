import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import {
  cp,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { patchGameTestLevelDat } from "./level-dat.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const WORLD_NAME = "sky_knights_bds_smoke";
const SENTINEL_NAME = ".sky-knights-bds-test-root";
const SENTINEL_VALUE = "sky-knights-bds-test-root-v1\n";
const LOCK_NAME = ".sky-knights-bds-smoke.lock";
const ARTIFACTS_NAME = "sky_knights_bds_artifacts";
const TEST_ID = "skyknights:skiff_has_pilot_and_passenger_seats";
const START_TIMEOUT_MS = 45_000;
const STOP_TIMEOUT_MS = 20_000;
const TEST_TIMEOUT_MS = 45_000;
const SUPPORTED_BOOTSTRAP_BDS_VERSION = "1.26.34.3";

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
  const lock = await acquireLock(paths.lock);
  let originalProperties;
  let artifactDirectory;
  let failure;
  let processStopped = true;

  try {
    await recoverInterruptedProperties(paths);
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

    await buildAndStage(paths);
    await writeRunMetadata(paths, artifactDirectory);
    await atomicWrite(
      paths.properties,
      smokeServerProperties(originalProperties),
    );

    await bootCreateAndStop(paths, artifactDirectory);
    await patchWorldAndActivatePacks(paths, artifactDirectory);
    const result = await bootAndRunGameTest(paths, artifactDirectory);

    await writeResult(artifactDirectory, { status: "passed", ...result });
    process.stdout.write(`BDS smoke test passed: ${TEST_ID}\n`);
  } catch (error) {
    if (artifactDirectory !== undefined) {
      await writeResult(artifactDirectory, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
    failure = error;
  } finally {
    const cleanupErrors = [];

    try {
      await activeSession?.stop("runner cleanup");
    } catch (error) {
      processStopped = activeSession?.exited === true;
      cleanupErrors.push(error);
    }
    activeSession = undefined;

    if (originalProperties !== undefined) {
      try {
        await atomicWrite(paths.properties, originalProperties);
        await rm(paths.propertiesBackup, { force: true });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }

    try {
      await lock.close();
    } catch (error) {
      cleanupErrors.push(error);
    }

    if (processStopped) {
      try {
        await rm(paths.lock, { force: true });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }

    if (cleanupErrors.length > 0) {
      failure = new AggregateError(
        failure === undefined ? cleanupErrors : [failure, ...cleanupErrors],
        "BDS smoke execution or cleanup failed.",
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

  const executable = path.join(resolved, "bedrock_server.exe");
  const sentinel = path.join(resolved, SENTINEL_NAME);
  const sentinelValue = await readFile(sentinel, "utf8").catch(() => undefined);

  if (sentinelValue !== SENTINEL_VALUE) {
    throw new Error(
      `Refusing to modify ${resolved}. Create ${SENTINEL_NAME} containing ${JSON.stringify(SENTINEL_VALUE)} in a dedicated test-only BDS root.`,
    );
  }

  const executableStats = await lstat(executable).catch(() => {
    throw new Error(`BDS executable is missing: ${executable}`);
  });

  if (!executableStats.isFile() || executableStats.isSymbolicLink()) {
    throw new Error(`BDS executable is not a safe file: ${executable}`);
  }

  return resolved;
}

async function runnerPaths(bdsRoot) {
  const paths = {
    root: bdsRoot,
    executable: path.join(bdsRoot, "bedrock_server.exe"),
    properties: path.join(bdsRoot, "server.properties"),
    worlds: path.join(bdsRoot, "worlds"),
    behaviorPacks: path.join(bdsRoot, "behavior_packs"),
    resourcePacks: path.join(bdsRoot, "resource_packs"),
    world: path.join(bdsRoot, "worlds", WORLD_NAME),
    stablePack: path.join(bdsRoot, "behavior_packs", "sky_knights_bds_stable"),
    gameTestPack: path.join(
      bdsRoot,
      "behavior_packs",
      "sky_knights_bds_gametest",
    ),
    resourcePack: path.join(
      bdsRoot,
      "resource_packs",
      "sky_knights_bds_resources",
    ),
    artifacts: path.join(bdsRoot, ARTIFACTS_NAME),
    lock: path.join(bdsRoot, LOCK_NAME),
    propertiesBackup: path.join(
      bdsRoot,
      ".sky-knights-server.properties.backup",
    ),
  };

  for (const [name, candidate] of Object.entries(paths)) {
    if (name === "root" || name === "executable" || name === "properties") {
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

  await mkdir(paths.worlds, { recursive: true });

  for (const directory of [
    paths.worlds,
    paths.behaviorPacks,
    paths.resourcePacks,
  ]) {
    const details = await lstat(directory).catch(() => undefined);

    if (!details?.isDirectory() || details.isSymbolicLink()) {
      throw new Error(`BDS directory is missing or unsafe: ${directory}`);
    }
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
    "Restored server.properties from an interrupted BDS smoke run.\n",
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

async function acquireLock(lockPath) {
  try {
    const lock = await open(lockPath, "wx");
    await lock.writeFile(
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    );
    return lock;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(`BDS smoke lock already exists: ${lockPath}`);
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

async function buildAndStage(paths) {
  await runNpm(["run", "build"]);
  await runNpm(["run", "build:gametest"]);

  const stableSource = path.join(root, "behavior_packs", "sk_bp");
  const resourceSource = path.join(root, "resource_packs", "sk_rp");
  const gameTestSource = path.join(
    root,
    "dist",
    "profiles",
    "sky_knights_gametest",
  );
  const stableScript = path.join(root, "dist", "scripts", "main.js");
  const stableDebug = path.join(root, "dist", "debug");

  await Promise.all([
    readFile(path.join(stableSource, "manifest.json")),
    readFile(path.join(resourceSource, "manifest.json")),
    readFile(path.join(gameTestSource, "manifest.json")),
    readFile(stableScript),
  ]);

  for (const target of [
    paths.stablePack,
    paths.resourcePack,
    paths.gameTestPack,
  ]) {
    await removeOwnedDirectory(paths.root, target);
  }

  await cp(stableSource, paths.stablePack, { recursive: true });
  await mkdir(path.join(paths.stablePack, "scripts"), { recursive: true });
  await cp(stableScript, path.join(paths.stablePack, "scripts", "main.js"));
  await cp(stableDebug, path.join(paths.stablePack, "debug"), {
    recursive: true,
  });
  await cp(resourceSource, paths.resourcePack, { recursive: true });
  await cp(gameTestSource, paths.gameTestPack, { recursive: true });
}

async function writeRunMetadata(paths, artifactDirectory) {
  const manifestPaths = {
    stable: path.join(paths.stablePack, "manifest.json"),
    resource: path.join(paths.resourcePack, "manifest.json"),
    gametest: path.join(paths.gameTestPack, "manifest.json"),
  };
  const manifests = {};

  for (const name of Object.keys(manifestPaths)) {
    const contents = await readFile(manifestPaths[name], "utf8");
    manifests[name] = JSON.parse(contents);
    await writeFile(
      path.join(artifactDirectory, `manifest.${name}.json`),
      contents,
    );
  }

  const packageDocument = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
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

  await writeFile(
    path.join(artifactDirectory, "run-metadata.json"),
    `${JSON.stringify(
      {
        command: "npm run test:bds:smoke",
        gitCommit: commit.stdout.trim(),
        gitDirty: status.stdout.trim().length > 0,
        packageVersion: packageDocument.version,
        approvedBdsVersion: SUPPORTED_BOOTSTRAP_BDS_VERSION,
        worldName: WORLD_NAME,
        ports: { ipv4: 19152, ipv6: 19153 },
        testId: TEST_ID,
        manifests,
      },
      undefined,
      2,
    )}\n`,
  );
}

async function removeOwnedDirectory(bdsRoot, directory) {
  assertOwnedPath(bdsRoot, directory, "runner-owned directory");
  const details = await lstat(directory).catch((error) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  });

  if (details?.isSymbolicLink()) {
    throw new Error(`Refusing runner-owned reparse target: ${directory}`);
  }

  await rm(directory, { recursive: true, force: true });
}

function runNpm(argumentsList) {
  const child =
    process.platform === "win32"
      ? spawn(
          process.env.ComSpec ?? "cmd.exe",
          ["/d", "/s", "/c", `npm ${argumentsList.join(" ")}`],
          { cwd: root, stdio: "inherit", windowsHide: true },
        )
      : spawn("npm", argumentsList, {
          cwd: root,
          stdio: "inherit",
          windowsHide: true,
        });
  return waitForExit(child, `npm ${argumentsList.join(" ")}`).then((code) => {
    if (code !== 0) {
      throw new Error(
        `npm ${argumentsList.join(" ")} exited with code ${code}.`,
      );
    }
  });
}

function smokeServerProperties(original) {
  const values = {
    "server-name": "Sky Knights BDS Smoke",
    "level-name": WORLD_NAME,
    gamemode: "creative",
    "force-gamemode": "true",
    "allow-cheats": "true",
    "online-mode": "true",
    "allow-list": "true",
    "server-port": "19152",
    "server-portv6": "19153",
    "enable-lan-visibility": "false",
    "default-player-permission-level": "operator",
    "content-log-file-enabled": "true",
    "content-log-console-output-enabled": "true",
    "content-log-level": "verbose",
    "view-distance": "8",
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

async function bootCreateAndStop(paths, artifacts) {
  await removeOwnedDirectory(paths.root, paths.world);
  const session = launchServer(paths, path.join(artifacts, "create.log"));
  activeSession = session;
  await session.waitFor(
    /Server started/iu,
    START_TIMEOUT_MS,
    "initial startup",
  );
  const version = serverVersion(session.output);

  if (version !== SUPPORTED_BOOTSTRAP_BDS_VERSION) {
    throw new Error(
      `BDS ${version ?? "(unreported)"} is not approved to bootstrap the GameTest level.dat; expected ${SUPPORTED_BOOTSTRAP_BDS_VERSION}.`,
    );
  }

  await writeFile(
    path.join(artifacts, "initial-boot.json"),
    `${JSON.stringify({ bdsVersion: version }, undefined, 2)}\n`,
  );
  await session.stop("initial world created");
  activeSession = undefined;
}

async function patchWorldAndActivatePacks(paths, artifacts) {
  const levelPath = path.join(paths.world, "level.dat");
  const original = await readFile(levelPath).catch(() => {
    throw new Error(`BDS did not create the expected level.dat: ${levelPath}`);
  });
  const patched = patchGameTestLevelDat(original);
  await writeFile(path.join(artifacts, "level.dat.before"), original);
  await writeFile(levelPath, patched.buffer);
  await writeFile(path.join(artifacts, "level.dat.after"), patched.buffer);
  await writeWorldPackFiles(paths);
}

async function writeWorldPackFiles(paths) {
  const stable = await packDescription(
    path.join(paths.stablePack, "manifest.json"),
  );
  const gameTest = await packDescription(
    path.join(paths.gameTestPack, "manifest.json"),
  );
  const resource = await packDescription(
    path.join(paths.resourcePack, "manifest.json"),
  );
  assertPackDependency(stable.manifest, resource.identity, "stable resource");
  assertPackDependency(
    gameTest.manifest,
    stable.identity,
    "GameTest stable behavior",
  );
  await writeFile(
    path.join(paths.world, "world_behavior_packs.json"),
    JSON.stringify([stable.identity, gameTest.identity], undefined, 2),
  );
  await writeFile(
    path.join(paths.world, "world_resource_packs.json"),
    JSON.stringify([resource.identity], undefined, 2),
  );
}

async function packDescription(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const { uuid, version } = manifest.header ?? {};

  if (typeof uuid !== "string" || !Array.isArray(version)) {
    throw new Error(`Invalid pack manifest: ${manifestPath}`);
  }

  return {
    identity: { pack_id: uuid, version },
    manifest,
  };
}

function assertPackDependency(manifest, expected, label) {
  const dependency = (manifest.dependencies ?? []).find(
    (candidate) => candidate.uuid === expected.pack_id,
  );

  if (
    dependency === undefined ||
    JSON.stringify(dependency.version) !== JSON.stringify(expected.version)
  ) {
    throw new Error(
      `The ${label} dependency does not match its staged pack identity.`,
    );
  }
}

async function bootAndRunGameTest(paths, artifacts) {
  const session = launchServer(paths, path.join(artifacts, "run.log"));
  activeSession = session;
  await session.waitFor(
    /Server started/iu,
    START_TIMEOUT_MS,
    "GameTest startup",
  );
  const version = serverVersion(session.output);

  if (version !== SUPPORTED_BOOTSTRAP_BDS_VERSION) {
    throw new Error(
      `BDS version changed between smoke boots: ${version ?? "(missing)"}; expected ${SUPPORTED_BOOTSTRAP_BDS_VERSION}.`,
    );
  }

  assertNoContentErrors(session.output, "GameTest startup");
  const start = session.output.length;
  session.send(`gametest run ${TEST_ID}`);
  const testResult = await waitForGameTestOutcome(session, start);
  assertNoContentErrors(session.output, "GameTest execution");
  await session.stop("GameTest completed");
  activeSession = undefined;

  if (testResult.outcome !== "passed") {
    throw new Error(
      `BDS reported ${testResult.outcome} for ${TEST_ID}; inspect ${path.join(artifacts, "run.log")}.`,
    );
  }

  return {
    bdsVersion: version,
    testId: TEST_ID,
    outcome: testResult.outcome,
    marker: testResult.marker,
  };
}

function serverVersion(output) {
  return output.match(
    /version\s*:\s*([0-9]+\.[0-9]+\.[0-9]+(?:\.[0-9]+)?)/iu,
  )?.[1];
}

async function waitForGameTestOutcome(session, start) {
  const deadline = Date.now() + TEST_TIMEOUT_MS;
  const passed = new RegExp(
    `^onTestPassed:\\s*${escapeRegExp(TEST_ID)}\\s*$`,
    "imu",
  );
  const failed = new RegExp(
    `^onTest(?:Failed|TimedOut):\\s*${escapeRegExp(TEST_ID)}(?:\\s|$)`,
    "imu",
  );

  while (Date.now() < deadline) {
    session.throwIfLogFailed();
    if (interrupted) {
      throw new Error("BDS smoke test interrupted.");
    }

    const output = session.output.slice(start);
    const passMarker = output.match(passed)?.[0];

    if (passMarker !== undefined) {
      return { outcome: "passed", marker: passMarker.trim() };
    }
    if (
      failed.test(output) ||
      (output.includes(TEST_ID) && /(not found|unknown command)/iu.test(output))
    ) {
      return { outcome: "failed", marker: undefined };
    }
    if (session.exited) {
      throw new Error("BDS exited before the GameTest reported an outcome.");
    }
    await delay(100);
  }

  throw new Error(
    `Timed out waiting for explicit GameTest output for ${TEST_ID}.`,
  );
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

  const structured = output.match(
    /\[Scripting\][^\r\n]*\{[^\r\n]*"level"\s*:\s*"(?:error|fatal)"[^\r\n]*\}/iu,
  )?.[0];

  if (structured !== undefined) {
    return structured;
  }

  return output.match(
    /\[Scripting\][^\r\n]*(?:unhandled|exception|run failed|failed to create context)[^\r\n]*/iu,
  )?.[0];
}

function waitForExit(child, description) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
    child.once("close", () => undefined);
    child.once("spawn", () => undefined);
    void description;
  });
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

async function writeResult(directory, result) {
  await writeFile(
    path.join(directory, "result.json"),
    `${JSON.stringify(result, undefined, 2)}\n`,
  );
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
    `BDS smoke test failed: ${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
}
