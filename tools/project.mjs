import { spawnSync } from "node:child_process";
import { watch } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { build as esbuild } from "esbuild";
import { unzipSync, zipSync } from "fflate";
import { format } from "prettier";
import typescript from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const command = args[0];
const production = args.includes("--production");

const sourceDirectories = ["scripts", "tests", "profiles", "tools"];
const behaviorPackSource = path.join(root, "behavior_packs", "sk_bp");
const resourcePackSource = path.join(root, "resource_packs", "sk_rp");
const scriptsOutput = path.join(root, "dist", "scripts");
const debugOutput = path.join(root, "dist", "debug");
const packagesOutput = path.join(root, "dist", "packages");
const TEMPLATE_INSTALL_NAME = "sky_knights_void_world";

switch (command) {
  case "lint":
    await lint(args.includes("--fix"));
    break;
  case "build":
    await build(production);
    break;
  case "clean":
    await clean();
    break;
  case "local-deploy":
    await localDeploy(args.includes("--once"));
    break;
  case "mcaddon":
    await createMcaddon(production);
    break;
  case "install-template":
    await installWorldTemplate();
    break;
  default:
    throw new Error(
      "Use lint [--fix], build [--production], clean, " +
        "local-deploy [--once], mcaddon [--production], or install-template.",
    );
}

async function lint(fix) {
  const files = await sourceFiles();
  const formattingErrors = [];
  const commandErrors = [];

  for (const file of files) {
    const original = await readFile(file, "utf8");
    const formatted = await format(original, { filepath: file });
    let checkedSource = original;

    if (formatted !== original) {
      if (fix) {
        await writeFile(file, formatted);
        checkedSource = formatted;
      } else {
        formattingErrors.push(relative(file));
      }
    }

    if (path.extname(file) === ".ts") {
      commandErrors.push(...findUnnecessaryCommands(file, checkedSource));
    }
  }

  for (const file of formattingErrors) {
    process.stderr.write(`${file}: file is not formatted by Prettier\n`);
  }

  for (const error of commandErrors) {
    process.stderr.write(
      `${error.file}:${error.line}:${error.column}: ` +
        `avoid ${error.method}(); use the corresponding Script API instead\n`,
    );
  }

  if (formattingErrors.length > 0 || commandErrors.length > 0) {
    throw new Error(
      `Lint failed with ${formattingErrors.length} formatting issue(s) and ` +
        `${commandErrors.length} unnecessary command call(s).`,
    );
  }

  process.stdout.write(
    `Lint passed (${files.length} files${fix ? ", fixes applied" : ""}).\n`,
  );
}

function findUnnecessaryCommands(file, source) {
  const sourceFile = typescript.createSourceFile(
    file,
    source,
    typescript.ScriptTarget.Latest,
    true,
    typescript.ScriptKind.TS,
  );
  const errors = [];

  function visit(node) {
    if (
      typescript.isCallExpression(node) &&
      typescript.isPropertyAccessExpression(node.expression) &&
      ["runCommand", "runCommandAsync"].includes(node.expression.name.text)
    ) {
      const position = sourceFile.getLineAndCharacterOfPosition(
        node.expression.name.getStart(sourceFile),
      );
      errors.push({
        file: relative(file),
        line: position.line + 1,
        column: position.character + 1,
        method: node.expression.name.text,
      });
    }

    typescript.forEachChild(node, visit);
  }

  visit(sourceFile);
  return errors;
}

async function sourceFiles() {
  const files = [];

  for (const directory of sourceDirectories) {
    files.push(
      ...(await filesUnder(path.join(root, directory), (file) =>
        [".ts", ".mjs"].includes(path.extname(file)),
      )),
    );
  }

  return files.sort();
}

async function build(isProduction) {
  typeCheck();

  await mkdir(scriptsOutput, { recursive: true });
  await mkdir(debugOutput, { recursive: true });

  const result = await esbuild({
    entryPoints: [path.join(root, "scripts", "main.ts")],
    outfile: path.join(scriptsOutput, "main.js"),
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es6",
    external: ["@minecraft/server", "@minecraft/server-ui"],
    sourcemap: "external",
    dropLabels: isProduction ? ["dev"] : undefined,
    logLevel: "warning",
    write: false,
  });
  const javascript = result.outputFiles.find(
    (file) => path.extname(file.path) === ".js",
  );
  const sourceMap = result.outputFiles.find((file) =>
    file.path.endsWith(".map"),
  );

  if (!javascript || !sourceMap) {
    throw new Error("esbuild did not produce the expected JavaScript and map.");
  }

  const sourceMapDocument = JSON.parse(sourceMap.text);
  sourceMapDocument.file = "../scripts/main.js";
  const javascriptText = `${javascript.text
    .replace(/\/\/# sourceMappingURL=main\.js\.map\s*$/u, "")
    .trimEnd()}\n//# sourceMappingURL=../debug/main.js.map\n`;

  await writeFile(path.join(scriptsOutput, "main.js"), javascriptText);
  await writeFile(
    path.join(debugOutput, "main.js.map"),
    JSON.stringify(sourceMapDocument),
  );
  process.stdout.write(
    `Built stable scripts${isProduction ? " (production)" : ""}.\n`,
  );
}

function typeCheck() {
  const compiler = path.join(root, "node_modules", "typescript", "bin", "tsc");
  const result = spawnSync(
    process.execPath,
    [compiler, "--project", path.join(root, "tsconfig.json")],
    {
      cwd: root,
      encoding: "utf8",
    },
  );

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`TypeScript exited with code ${result.status}.`);
  }
}

async function clean() {
  await removeWithin(root, path.join(root, "dist"));
  await removeWithin(root, path.join(root, "lib"));
  process.stdout.write("Removed dist and lib build output.\n");
}

async function localDeploy(once) {
  await build(false);
  await deployStablePacks();

  if (once) {
    return;
  }

  process.stdout.write("Watching stable pack sources. Press Ctrl+C to stop.\n");
  const watchers = [
    path.join(root, "scripts"),
    path.join(root, "behavior_packs"),
    path.join(root, "resource_packs"),
  ].map((directory) =>
    watch(directory, { recursive: true }, () => scheduleDeploy()),
  );
  let timer;
  let running = false;
  let rerun = false;

  function scheduleDeploy() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (running) {
        rerun = true;
        return;
      }

      running = true;

      try {
        await build(false);
        await deployStablePacks();
      } catch (error) {
        process.stderr.write(
          `${error instanceof Error ? error.stack : error}\n`,
        );
      } finally {
        running = false;

        if (rerun) {
          rerun = false;
          scheduleDeploy();
        }
      }
    }, 200);
  }

  process.once("SIGINT", () => {
    clearTimeout(timer);

    for (const activeWatcher of watchers) {
      activeWatcher.close();
    }

    process.stdout.write("Stopped deployment watcher.\n");
  });
}

async function deployStablePacks() {
  const deploymentRoot = await resolveDeploymentRoot();
  const behaviorRoot = path.resolve(
    deploymentRoot,
    "development_behavior_packs",
  );
  const resourceRoot = path.resolve(
    deploymentRoot,
    "development_resource_packs",
  );
  const behaviorTarget = path.resolve(behaviorRoot, "sky_knights");
  const resourceTarget = path.resolve(resourceRoot, "sky_knights");

  await replaceDirectory(behaviorRoot, behaviorTarget, behaviorPackSource);
  await mkdir(path.join(behaviorTarget, "scripts"), { recursive: true });
  await cp(scriptsOutput, path.join(behaviorTarget, "scripts"), {
    recursive: true,
  });
  await replaceDirectory(resourceRoot, resourceTarget, resourcePackSource);

  process.stdout.write(`Deployed behavior pack: ${behaviorTarget}\n`);
  process.stdout.write(`Deployed resource pack: ${resourceTarget}\n`);
}

async function createMcaddon(isProduction) {
  await build(isProduction);
  await mkdir(packagesOutput, { recursive: true });

  const environment = await readEnvironment(path.join(root, ".env"));
  const projectName = environment.PROJECT_NAME || "sky_knights";

  const behaviorEntries = await zipEntries(behaviorPackSource);
  Object.assign(behaviorEntries, await zipEntries(scriptsOutput, "scripts"));
  const behaviorPack = zipSync(behaviorEntries);
  const resourcePack = zipSync(await zipEntries(resourcePackSource));
  const behaviorName = `${projectName}_bp.mcpack`;
  const resourceName = `${projectName}_rp.mcpack`;
  const addonName = `${projectName}.mcaddon`;

  await writeFile(path.join(packagesOutput, behaviorName), behaviorPack);
  await writeFile(path.join(packagesOutput, resourceName), resourcePack);
  await writeFile(
    path.join(packagesOutput, addonName),
    zipSync({
      [behaviorName]: behaviorPack,
      [resourceName]: resourcePack,
    }),
  );
  process.stdout.write(
    `Built add-on: ${relative(path.join(packagesOutput, addonName))}\n`,
  );
}

/**
 * Installs the built `.mctemplate` straight into the local Minecraft
 * `world_templates` folder.
 *
 * Double-clicking a `.mctemplate` only works when Windows has a handler
 * registered for the extension. The GDK Bedrock install on this project's
 * reference machine registers none, so the file silently does nothing and the
 * template never appears under Create New World. Extracting it here is the
 * reliable developer path and needs no file association.
 *
 * This writes one directory it owns and never touches worlds or other packs.
 */
async function installWorldTemplate() {
  const archivePath = path.join(
    root,
    "dist",
    "world-template",
    "sky_knights_void_world.mctemplate",
  );
  let archive;

  try {
    archive = await readFile(archivePath);
  } catch {
    throw new Error(
      `No template at ${archivePath}. Run "npm run world-template:void" first.`,
    );
  }

  const entries = unzipSync(new Uint8Array(archive));

  if (entries["manifest.json"] === undefined) {
    throw new Error("Template archive has no root manifest.json.");
  }

  const templatesRoot = path.join(
    await resolveDeploymentRoot(),
    "world_templates",
  );
  const target = path.join(templatesRoot, TEMPLATE_INSTALL_NAME);
  assertChild(templatesRoot, target);
  await rm(target, { recursive: true, force: true });

  for (const name of Object.keys(entries).sort()) {
    const destination = path.join(target, name);
    assertChild(target, destination);

    if (name.endsWith("/")) {
      await mkdir(destination, { recursive: true });
      continue;
    }

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, entries[name]);
  }

  console.log(`Installed world template: ${target}`);
  console.log("Restart Minecraft, then Play -> Create New -> Templates.");
}

async function resolveDeploymentRoot() {
  const environment = await readEnvironment(path.join(root, ".env"));

  if (environment.CUSTOM_DEPLOYMENT_PATH) {
    return path.resolve(root, environment.CUSTOM_DEPLOYMENT_PATH);
  }

  if (!process.env.APPDATA) {
    throw new Error(
      "APPDATA is unavailable; set CUSTOM_DEPLOYMENT_PATH in .env.",
    );
  }

  const products = {
    BedrockGDK: "Minecraft Bedrock",
    PreviewGDK: "Minecraft Bedrock Preview",
  };
  const product =
    environment.MINECRAFT_PRODUCT === undefined
      ? "BedrockGDK"
      : environment.MINECRAFT_PRODUCT;
  const productDirectory = products[product];

  if (!productDirectory) {
    throw new Error(`Unsupported MINECRAFT_PRODUCT: ${product}`);
  }

  return path.join(
    process.env.APPDATA,
    productDirectory,
    "Users",
    "Shared",
    "games",
    "com.mojang",
  );
}

async function replaceDirectory(parent, target, source) {
  assertChild(parent, target);
  await rm(target, { recursive: true, force: true });
  await mkdir(parent, { recursive: true });
  await cp(source, target, { recursive: true });
}

async function removeWithin(parent, target) {
  assertChild(parent, target);
  await rm(target, { recursive: true, force: true });
}

function assertChild(parent, target) {
  const pathFromParent = path.relative(
    path.resolve(parent),
    path.resolve(target),
  );

  if (
    pathFromParent.length === 0 ||
    pathFromParent.startsWith(`..${path.sep}`) ||
    path.isAbsolute(pathFromParent)
  ) {
    throw new Error(`Refusing unsafe filesystem target: ${target}`);
  }
}

async function filesUnder(directory, predicate = () => true) {
  const files = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await filesUnder(fullPath, predicate)));
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function zipEntries(directory, prefix = "") {
  const result = {};

  for (const file of await filesUnder(directory)) {
    const archivePath = path.posix.join(
      prefix,
      path.relative(directory, file).split(path.sep).join(path.posix.sep),
    );
    result[archivePath] = new Uint8Array(await readFile(file));
  }

  return result;
}

async function readEnvironment(file) {
  const values = {};
  let contents;

  try {
    contents = await readFile(file, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return values;
    }

    throw error;
  }

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
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

function relative(file) {
  return path.relative(root, file);
}
