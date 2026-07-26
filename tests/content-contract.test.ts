import { describe, expect, it } from "vitest";

import { ADDON_VERSION } from "../scripts/config/constants";
import { ISLAND_DEFINITIONS } from "../scripts/config/islands";
import { ISLAND_CONTENT_TABLE } from "../scripts/generation/content-table";

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const ENTITY_SOURCES: Record<string, string> = import.meta.glob(
  "../behavior_packs/sk_bp/entities/*.json",
  { eager: true, query: "?raw", import: "default" },
);

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const ITEM_SOURCES: Record<string, string> = import.meta.glob(
  "../behavior_packs/sk_bp/items/*.json",
  { eager: true, query: "?raw", import: "default" },
);

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const STRUCTURE_URLS: Record<string, string> = import.meta.glob(
  "../behavior_packs/sk_bp/structures/skyknights/*.mcstructure",
  { eager: true, query: "?url", import: "default" },
);

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const LANGUAGE_SOURCES: Record<string, string> = import.meta.glob(
  "../resource_packs/sk_rp/texts/en_US.lang",
  { eager: true, query: "?raw", import: "default" },
);

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const PACKAGE_SOURCES: Record<string, string> = import.meta.glob(
  "../package.json",
  { eager: true, query: "?raw", import: "default" },
);

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const BEHAVIOR_MANIFEST_SOURCES: Record<string, string> = import.meta.glob(
  "../behavior_packs/sk_bp/manifest.json",
  { eager: true, query: "?raw", import: "default" },
);

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const RESOURCE_MANIFEST_SOURCES: Record<string, string> = import.meta.glob(
  "../resource_packs/sk_rp/manifest.json",
  { eager: true, query: "?raw", import: "default" },
);

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const GAMETEST_MANIFEST_SOURCES: Record<string, string> = import.meta.glob(
  "../profiles/gametest/behavior_pack/manifest.json",
  { eager: true, query: "?raw", import: "default" },
);

function identifiers(
  sources: Record<string, string>,
  rootKey: "minecraft:entity" | "minecraft:item",
): readonly string[] {
  return Object.keys(sources)
    .sort()
    .map((path) => {
      const document = JSON.parse(sources[path]) as Record<
        string,
        { description?: { identifier?: unknown } }
      >;
      const identifier = document[rootKey]?.description?.identifier;

      if (typeof identifier !== "string") {
        throw new Error(`${path} has no ${rootKey} description identifier.`);
      }

      return identifier;
    });
}

function onlyValue(sources: Record<string, string>): string {
  const keys = Object.keys(sources);

  if (keys.length !== 1) {
    throw new Error(`Expected exactly one source file, found ${keys.length}.`);
  }

  return sources[keys[0]];
}

describe("packaged content contract", () => {
  const entityIds = identifiers(ENTITY_SOURCES, "minecraft:entity");
  const itemIds = identifiers(ITEM_SOURCES, "minecraft:item");
  const language = onlyValue(LANGUAGE_SOURCES);

  it("ships every island structure registered by the deterministic layout", () => {
    const paths = Object.keys(STRUCTURE_URLS);

    for (const island of ISLAND_DEFINITIONS) {
      const fileName = `${island.structureId.split(":")[1]}.mcstructure`;
      expect(
        paths.some((path) => path.endsWith(`/${fileName}`)),
        `${island.id} is registered but ${fileName} is not packaged`,
      ).toBe(true);
    }
  });

  it("localizes every shipped custom entity and item", () => {
    for (const id of entityIds) {
      expect(language).toContain(`entity.${id}.name=`);
    }

    for (const id of itemIds) {
      expect(language).toContain(`item.${id}.name=`);
    }
  });

  it("allows executable island content to reference only packaged custom IDs", () => {
    for (const content of ISLAND_CONTENT_TABLE) {
      for (const item of content.lootChest?.items ?? []) {
        if (item.itemId.startsWith("skyknights:")) {
          expect(
            itemIds,
            `${content.id} uses missing item ${item.itemId}`,
          ).toContain(item.itemId);
        }
      }

      for (const entity of [
        ...(content.encounters ?? []),
        ...(content.npcs ?? []),
      ]) {
        if (entity.entityId.startsWith("skyknights:")) {
          expect(
            entityIds,
            `${content.id} uses missing entity ${entity.entityId}`,
          ).toContain(entity.entityId);
        }
      }
    }
  });
});

describe("playtest build identity", () => {
  interface Manifest {
    header: { uuid: string; version: number[] };
    modules: { version: number[] }[];
    dependencies?: { uuid?: string; version?: number[] }[];
  }

  const packageVersion = (
    JSON.parse(onlyValue(PACKAGE_SOURCES)) as { version: string }
  ).version;
  const behavior = JSON.parse(onlyValue(BEHAVIOR_MANIFEST_SOURCES)) as Manifest;
  const resource = JSON.parse(onlyValue(RESOURCE_MANIFEST_SOURCES)) as Manifest;
  const gametest = JSON.parse(onlyValue(GAMETEST_MANIFEST_SOURCES)) as Manifest;

  it("keeps package, runtime diagnostics, and stable manifests on one version", () => {
    expect(ADDON_VERSION).toBe(packageVersion);
    expect(behavior.header.version.join(".")).toBe(packageVersion);
    expect(resource.header.version.join(".")).toBe(packageVersion);

    for (const module of [
      ...behavior.modules,
      ...resource.modules,
      ...gametest.modules,
    ]) {
      expect(module.version.join(".")).toBe(packageVersion);
    }
  });

  it("keeps cross-pack and GameTest dependencies aligned", () => {
    const resourceDependency = behavior.dependencies?.find(
      (dependency) => dependency.uuid === resource.header.uuid,
    );
    const behaviorDependency = gametest.dependencies?.find(
      (dependency) => dependency.uuid === behavior.header.uuid,
    );

    expect(resourceDependency?.version?.join(".")).toBe(packageVersion);
    expect(gametest.header.version.join(".")).toBe(packageVersion);
    expect(behaviorDependency?.version?.join(".")).toBe(packageVersion);
  });
});
