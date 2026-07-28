declare module "*package-world-template.mjs" {
  export function packageWorldTemplate(options: {
    rootDirectory: string;
    sourceWorld: string;
    outputRoot: string;
  }): Promise<{ templatePath: string; staging: string }>;
}

declare module "*bds/nbt.mjs" {
  export const TAG: any;
  export function writeLevelDat(value: any): Uint8Array;
}

declare module "*bds/void-level-dat.mjs" {
  export function patchVoidLevelDat(value: Uint8Array): Uint8Array;
}

declare module "node:fs/promises" {
  export const mkdir: any;
  export const mkdtemp: any;
  export const readFile: any;
  export const rm: any;
  export const writeFile: any;
}

declare module "node:os" {
  export const tmpdir: any;
}

declare module "node:path" {
  const path: any;
  export default path;
}
