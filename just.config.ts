import { argv, parallel, series, task, tscTask } from "just-scripts";
import {
  BundleTaskParameters,
  CopyTaskParameters,
  DEFAULT_CLEAN_DIRECTORIES,
  STANDARD_CLEAN_PATHS,
  ZipTaskParameters,
  bundleTask,
  cleanCollateralTask,
  cleanTask,
  copyTask,
  coreLint,
  getOrThrowFromProcess,
  mcaddonTask,
  setupEnvironment,
  watchTask,
} from "@minecraft/core-build-tasks";
import path from "path";

setupEnvironment(path.resolve(__dirname, ".env"));
const projectName = getOrThrowFromProcess("PROJECT_NAME");
const isProduction = argv().production;

const bundleTaskOptions: BundleTaskParameters = {
  entryPoint: path.join(__dirname, "./scripts/main.ts"),
  external: ["@minecraft/server", "@minecraft/server-ui"],
  outfile: path.resolve(__dirname, "./dist/scripts/main.js"),
  minifyWhitespace: false,
  sourcemap: true,
  outputSourcemapPath: path.resolve(__dirname, "./dist/debug"),
  dropLabels: isProduction ? ["dev"] : undefined,
};

const copyTaskOptions: CopyTaskParameters = {
  copyToBehaviorPacks: ["./behavior_packs/sk_bp"],
  copyToScripts: ["./dist/scripts"],
  copyToResourcePacks: ["./resource_packs/sk_rp"],
};

const mcaddonTaskOptions: ZipTaskParameters = {
  ...copyTaskOptions,
  outputFile: `./dist/packages/${projectName}.mcaddon`,
};

task("lint", coreLint(["scripts/**/*.ts", "tests/**/*.ts"], argv().fix));

task("typescript", tscTask());
task("bundle", bundleTask(bundleTaskOptions));
task("build", series("typescript", "bundle"));

task("clean-local", cleanTask(DEFAULT_CLEAN_DIRECTORIES));
task("clean-collateral", cleanCollateralTask(STANDARD_CLEAN_PATHS));
task("clean", parallel("clean-local", "clean-collateral"));

task("copyArtifacts", copyTask(copyTaskOptions));
task("package", series("clean-collateral", "copyArtifacts"));

task(
  "local-deploy",
  watchTask(
    [
      "scripts/**/*.ts",
      "behavior_packs/**/*.{json,lang,png,mcstructure}",
      "resource_packs/**/*.{json,lang,png,tga,ogg,wav}",
    ],
    series("clean-local", "build", "package"),
  ),
);

task("createMcaddonFile", mcaddonTask(mcaddonTaskOptions));
task("mcaddon", series("clean-local", "build", "createMcaddonFile"));
