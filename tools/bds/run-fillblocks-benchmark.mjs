// Opt-in BDS harness for the four fillBlocks GameTests. It only touches a
// sentinel-protected external BDS root and retains all run evidence there.
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

import {
  EXPECTED_METRIC_BY_TEST_ID,
  FOOTPRINT,
  REGION,
  TEST_IDS,
  TICKING_AREA_NAME,
  parseBdsVersion,
  parseEnvironmentFile,
  parseFillBlocksMarkers,
  patchServerProperties,
} from "./fillblocks-plan.mjs";
import { patchGameTestLevelDat } from "./level-dat.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const worldName = "sky_knights_bds_fillblocks_benchmark";
const sentinelName = ".sky-knights-bds-test-root";
const sentinelValue = "sky-knights-bds-test-root-v1\n";
const ownLockName = ".sky-knights-bds-fillblocks-benchmark.lock";
const sharedLockName = ".sky-knights-bds-smoke.lock";
const backupName = ".sky-knights-bds-fillblocks-server.properties.backup";
const artifactsName = "sky_knights_bds_fillblocks_artifacts";
const ports = { ipv4: 19_156, ipv6: 19_157 };
const bdsVersion = "1.26.34.3";
const stopTimeoutMs = 20_000;
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
  const paths = await pathsFor(bdsRoot);
  const locks = await acquireLocks(paths);
  let originalProperties;
  let artifacts;
  let failure;
  let results;
  try {
    await restoreInterruptedProperties(paths);
    artifacts = await artifactDirectory(paths);
    originalProperties = await readFile(paths.properties, "utf8");
    await writeFile(paths.backup, originalProperties, { flag: "wx" });
    await buildAndStage(paths);
    throwIfInterrupted();
    await atomicWrite(
      paths.properties,
      benchmarkProperties(originalProperties),
    );
    await createWorld(paths, artifacts);
    await patchWorld(paths, artifacts);
    results = await runTests(paths, artifacts);
    const passed = results.every((result) => result.outcome === "passed");
    await writeJson(path.join(artifacts, "result.json"), {
      status: passed ? "passed" : "failed",
      bdsVersion,
      region: REGION,
      footprint: FOOTPRINT,
      results,
    });
    if (!passed)
      throw new Error(
        `A fillBlocks GameTest or required metric failed; inspect ${artifacts}.`,
      );
    process.stdout.write(`fillBlocks benchmark completed: ${artifacts}\n`);
  } catch (error) {
    if (artifacts)
      await writeJson(path.join(artifacts, "result.json"), {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        ...(results === undefined
          ? {}
          : {
              bdsVersion,
              region: REGION,
              footprint: FOOTPRINT,
              results,
            }),
      }).catch(() => undefined);
    failure = error;
  } finally {
    const errors = [];
    try {
      await activeSession?.stop("runner cleanup");
    } catch (error) {
      errors.push(error);
    }
    if (originalProperties !== undefined) {
      try {
        await atomicWrite(paths.properties, originalProperties);
        await rm(paths.backup, { force: true });
      } catch (error) {
        errors.push(error);
      }
    }
    for (const lock of locks) {
      try {
        await lock.handle.close();
        await rm(lock.path, { force: true });
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      failure = new AggregateError(
        failure ? [failure, ...errors] : errors,
        "BDS fillBlocks benchmark cleanup failed.",
      );
  }
  if (failure) throw failure;
}

async function resolveBdsRoot() {
  const environment = await readEnvironment(path.join(root, ".env"));
  const configured =
    process.env.SKY_KNIGHTS_BDS_ROOT ?? environment.SKY_KNIGHTS_BDS_ROOT;
  if (!configured?.trim())
    throw new Error(
      "SKY_KNIGHTS_BDS_ROOT is required for the opt-in BDS benchmark.",
    );
  const resolved = await realpath(configured);
  const repository = await realpath(root);
  if (
    path.parse(resolved).root === resolved ||
    resolved === repository ||
    descendant(resolved, repository) ||
    descendant(repository, resolved)
  )
    throw new Error(
      "SKY_KNIGHTS_BDS_ROOT must be a dedicated non-repository directory.",
    );
  if (
    (await readFile(path.join(resolved, sentinelName), "utf8").catch(
      () => undefined,
    )) !== sentinelValue
  )
    throw new Error(`Refusing BDS root without ${sentinelName} sentinel.`);
  const executable = await lstat(
    path.join(resolved, "bedrock_server.exe"),
  ).catch(() => undefined);
  if (!executable?.isFile() || executable.isSymbolicLink())
    throw new Error("BDS executable is missing or unsafe.");
  return resolved;
}

async function readEnvironment(filePath) {
  try {
    return parseEnvironmentFile(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

function descendant(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

async function pathsFor(base) {
  const paths = {
    root: base,
    executable: path.join(base, "bedrock_server.exe"),
    properties: path.join(base, "server.properties"),
    worlds: path.join(base, "worlds"),
    behavior: path.join(base, "behavior_packs"),
    resource: path.join(base, "resource_packs"),
    world: path.join(base, "worlds", worldName),
    stable: path.join(
      base,
      "behavior_packs",
      "sky_knights_bds_fillblocks_stable",
    ),
    gametest: path.join(
      base,
      "behavior_packs",
      "sky_knights_bds_fillblocks_gametest",
    ),
    resources: path.join(
      base,
      "resource_packs",
      "sky_knights_bds_fillblocks_resources",
    ),
    artifacts: path.join(base, artifactsName),
    backup: path.join(base, backupName),
    sharedLock: path.join(base, sharedLockName),
    ownLock: path.join(base, ownLockName),
  };
  for (const [name, candidate] of Object.entries(paths))
    if (
      !["root", "executable", "properties"].includes(name) &&
      !descendant(base, candidate)
    )
      throw new Error(`Unsafe runner path: ${candidate}`);
  for (const directory of [paths.worlds, paths.behavior, paths.resource]) {
    const stats = await lstat(directory).catch(() => undefined);
    if (!stats?.isDirectory() || stats.isSymbolicLink())
      throw new Error(`BDS directory is missing or unsafe: ${directory}`);
  }
  const properties = await lstat(paths.properties).catch(() => undefined);
  if (!properties?.isFile() || properties.isSymbolicLink())
    throw new Error("server.properties is missing or unsafe.");
  return paths;
}

async function acquireLocks(paths) {
  const locks = [];
  try {
    for (const lockPath of [paths.sharedLock, paths.ownLock]) {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(
        JSON.stringify({
          pid: process.pid,
          startedAt: new Date().toISOString(),
        }),
      );
      locks.push({ path: lockPath, handle });
    }
    return locks;
  } catch (error) {
    for (const lock of locks) {
      await lock.handle.close().catch(() => undefined);
      await rm(lock.path, { force: true }).catch(() => undefined);
    }
    throw error;
  }
}

async function restoreInterruptedProperties(paths) {
  const backup = await lstat(paths.backup).catch(() => undefined);
  if (!backup) return;
  if (!backup.isFile() || backup.isSymbolicLink())
    throw new Error("Interrupted server.properties backup is unsafe.");
  await atomicWrite(paths.properties, await readFile(paths.backup, "utf8"));
  await rm(paths.backup);
}

async function artifactDirectory(paths) {
  const existing = await lstat(paths.artifacts).catch(() => undefined);
  if (existing?.isSymbolicLink() || (existing && !existing.isDirectory()))
    throw new Error("BDS artifact directory is unsafe.");
  if (!existing) await mkdir(paths.artifacts);
  const directory = path.join(
    paths.artifacts,
    new Date().toISOString().replace(/[:.]/gu, "-"),
  );
  await mkdir(directory);
  return directory;
}

async function removeOwned(base, directory) {
  if (!descendant(base, directory))
    throw new Error(`Unsafe deletion target: ${directory}`);
  const stats = await lstat(directory).catch(() => undefined);
  if (stats?.isSymbolicLink())
    throw new Error(`Refusing reparse deletion target: ${directory}`);
  await rm(directory, { recursive: true, force: true });
}

async function buildAndStage(paths) {
  await runNpm(["run", "build"]);
  await runNpm(["run", "build:gametest"]);
  for (const target of [paths.stable, paths.gametest, paths.resources])
    await removeOwned(paths.root, target);
  await cp(path.join(root, "behavior_packs", "sk_bp"), paths.stable, {
    recursive: true,
  });
  await mkdir(path.join(paths.stable, "scripts"), { recursive: true });
  await cp(
    path.join(root, "dist", "scripts", "main.js"),
    path.join(paths.stable, "scripts", "main.js"),
  );
  await cp(path.join(root, "dist", "debug"), path.join(paths.stable, "debug"), {
    recursive: true,
  });
  await cp(
    path.join(root, "dist", "profiles", "sky_knights_gametest"),
    paths.gametest,
    { recursive: true },
  );
  await cp(path.join(root, "resource_packs", "sk_rp"), paths.resources, {
    recursive: true,
  });
}

function runNpm(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm",
      process.platform === "win32"
        ? ["/d", "/s", "/c", `npm ${args.join(" ")}`]
        : args,
      { cwd: root, stdio: "inherit", windowsHide: true },
    );
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`npm ${args.join(" ")} failed (${code}).`)),
    );
  });
}

function benchmarkProperties(original) {
  const values = {
    "server-name": "Sky Knights fillBlocks benchmark",
    "level-name": worldName,
    gamemode: "creative",
    "force-gamemode": "true",
    "allow-cheats": "true",
    "online-mode": "true",
    "allow-list": "true",
    "server-port": String(ports.ipv4),
    "server-portv6": String(ports.ipv6),
    "enable-lan-visibility": "false",
    "content-log-console-output-enabled": "true",
    "content-log-level": "verbose",
  };
  return patchServerProperties(original, values);
}

async function createWorld(paths, artifacts) {
  await removeOwned(paths.root, paths.world);
  const session = launch(paths, path.join(artifacts, "create.log"));
  activeSession = session;
  await session.wait(/Server started/iu, "initial startup");
  requireVersion(session.output);
  await session.stop("initial world created");
  activeSession = undefined;
}

async function patchWorld(paths) {
  const level = path.join(paths.world, "level.dat");
  await writeFile(level, patchGameTestLevelDat(await readFile(level)).buffer);
  const stable = await identity(path.join(paths.stable, "manifest.json"));
  const gametest = await identity(path.join(paths.gametest, "manifest.json"));
  const resource = await identity(path.join(paths.resources, "manifest.json"));
  await writeJson(path.join(paths.world, "world_behavior_packs.json"), [
    stable,
    gametest,
  ]);
  await writeJson(path.join(paths.world, "world_resource_packs.json"), [
    resource,
  ]);
}

async function identity(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  return { pack_id: manifest.header.uuid, version: manifest.header.version };
}

async function runTests(paths, artifacts) {
  const session = launch(paths, path.join(artifacts, "run.log"));
  activeSession = session;
  await session.wait(/Server started/iu, "benchmark startup");
  requireVersion(session.output);
  session.send(
    `tickingarea add ${REGION.minX} 0 ${REGION.minZ} ${REGION.minX + REGION.size - 1} 0 ${REGION.minZ + REGION.size - 1} ${TICKING_AREA_NAME}`,
  );
  await delay(3000);
  const results = [];
  for (const testId of TEST_IDS) {
    const start = session.output.length;
    session.send(`gametest run ${testId}`);
    const outcome = await waitForOutcome(session, start, testId);
    const markers = parseFillBlocksMarkers(session.output.slice(start));
    const expectedMetric = EXPECTED_METRIC_BY_TEST_ID.get(testId);
    const metric =
      markers.find((marker) => marker.metric === expectedMetric) ?? null;
    results.push({
      testId,
      ...outcome,
      expectedMetric,
      marker: metric,
      markers,
    });
    if (metric === null) results.at(-1).outcome = "failed";
  }
  session.send(`tickingarea remove ${TICKING_AREA_NAME}`);
  await session.stop("benchmark completed");
  activeSession = undefined;
  return results;
}

async function waitForOutcome(session, start, testId) {
  const deadline = Date.now() + 60000;
  const pass = new RegExp(`^onTestPassed:\\s*${testId}\\s*$`, "imu");
  const fail = new RegExp(`^onTest(?:Failed|TimedOut):\\s*${testId}`, "imu");
  while (Date.now() < deadline) {
    const output = session.output.slice(start);
    if (pass.test(output)) return { outcome: "passed" };
    if (
      fail.test(output) ||
      (output.includes(testId) && /not found|unknown command/iu.test(output))
    )
      return { outcome: "failed" };
    if (session.exited)
      throw new Error(`BDS exited before ${testId} completed.`);
    await delay(100);
  }
  return { outcome: "failed" };
}

function requireVersion(output) {
  const version = parseBdsVersion(output);
  if (version !== bdsVersion)
    throw new Error(
      `BDS ${version ?? "(unreported)"} is not approved; expected ${bdsVersion}.`,
    );
}

function launch(paths, logPath) {
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
      if (!this.exited) child.stdin.write(`${command}\n`);
    },
    async wait(pattern, stage) {
      const deadline = Date.now() + 45000;
      while (Date.now() < deadline) {
        this.throwIfLogFailed();
        throwIfInterrupted();
        if (pattern.test(this.output)) return;
        if (this.exited)
          throw new Error(
            `BDS exited during ${stage} with code ${String(this.exitCode)}.`,
          );
        await delay(100);
      }
      throw new Error(`Timed out waiting for ${stage}.`);
    },
    async stop(reason) {
      if (this.exited) {
        this.throwIfLogFailed();
        return;
      }
      this.send("stop");
      const stopped = await waitForExitWithin(this.child, stopTimeoutMs);

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

async function atomicWrite(filePath, contents) {
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, contents, { flag: "wx" });
  await rename(temporary, filePath);
}
async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, undefined, 2)}\n`);
}
function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function throwIfInterrupted() {
  if (interrupted) {
    throw new Error("BDS fillBlocks benchmark interrupted.");
  }
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

try {
  await main();
} catch (error) {
  process.stderr.write(
    `BDS fillBlocks benchmark failed: ${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
}
