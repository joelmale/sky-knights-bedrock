// Progression reachability graph for the closure test (roadmap 8, 10, 11/4).
//
// This module is the machine-readable form of the "Progression ladder" and
// "Items" sections of `docs/CONTENT_MATRIX.md`. It exists so a host-side test
// can prove that a player who starts on the home island holding NOTHING can
// obtain every item the matrix marks `Guaranteed = yes`, without relying on a
// single random drop.
//
// Modelling rules:
// - A node is one rule the player can apply: mine, craft, smelt, loot a
//   guaranteed chest, receive an NPC award, defeat an encounter, assemble a
//   ship, or travel to an island.
// - `requires` and `grants` hold TOKENS. A token is either a real item id
//   (`minecraft:iron_ingot`, `skyknights:ship_core`) or a capability token
//   (`access:ember_outpost`, `ship:skycutter`, `unlock:skycutter_blueprint`).
//   Capability tokens use prefixes that can never collide with an item id
//   because every shipped item id contains a `minecraft:`/`skyknights:`
//   namespace.
// - Reachability is a monotone set closure: presence, not quantity. Quantity
//   gates that the closure cannot express are declared in `QUANTITY_GATES` and
//   `oneTime` so the test can still assert something meaningful about them.
// - `status` mirrors the matrix `Status` column. `planned` rows are DECLARED
//   here so the intended design can be proven closed, but the built-only scope
//   still runs, so a planned source can never silently satisfy a built item.
//
// Determinism: pure data plus set operations, iterated in declaration order.
// No `Math.random`, no `Date.now`, no unsorted iteration.

import { IDENTIFIERS } from "../config/constants";

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export const ACCESS_PREFIX = "access:";
export const SHIP_PREFIX = "ship:";
export const UNLOCK_PREFIX = "unlock:";

export function islandAccessToken(islandId: string): string {
  return `${ACCESS_PREFIX}${islandId}`;
}

export function shipToken(shipId: string): string {
  return `${SHIP_PREFIX}${shipId}`;
}

/**
 * Ship capability per travel tier, matching the `Tier` column of the islands
 * table: 1 = starter skiff, 2 = Skycutter, 3 = refit Skycutter.
 */
export const SHIP_TOKENS_BY_TIER: Readonly<Record<number, string>> = {
  1: shipToken("skiff"),
  2: shipToken("skycutter"),
  3: shipToken("refit_skycutter"),
};

export function shipTokenForTier(tier: number): string {
  const token = SHIP_TOKENS_BY_TIER[tier];

  if (token === undefined) {
    throw new Error(
      `No Sky Knights ship capability is defined for tier ${tier}.`,
    );
  }

  return token;
}

/**
 * Identifiers the content matrix declares but `IDENTIFIERS` does not carry yet,
 * because no implementing content ships. The integrator adds these to
 * `scripts/config/constants.ts` when the Phase 4 source lands; keeping them in
 * one place here means the graph never hand-types them twice.
 */
export const PLANNED_IDENTIFIERS = {
  relicShard: "skyknights:relic_shard",
  aetherCore: "skyknights:aether_core",
} as const;

// ---------------------------------------------------------------------------
// Node model
// ---------------------------------------------------------------------------

export type ProgressionStatus = "built" | "planned";

/** `built` = shipping rules only. `declared` = shipping plus planned rules. */
export type ProgressionScope = "built" | "declared";

export type ProgressionKind =
  | "assembly"
  | "craft"
  | "encounter"
  | "loot"
  | "mine"
  | "npc_award"
  | "smelt"
  | "start"
  | "travel";

export interface ProgressionNode {
  /** Stable rule id. `craft:<recipe identifier>` matches the recipe JSON. */
  id: string;
  kind: ProgressionKind;
  status: ProgressionStatus;
  /** Tokens the player must already hold for this rule to apply. */
  requires: readonly string[];
  /** Tokens the rule yields. */
  grants: readonly string[];
  /** Island this rule belongs to, when it is island-local. */
  island?: string;
  /**
   * True when the rule yields its grants once per island content version
   * (shared structure chests, per the matrix multiplayer policy). Repeatable
   * sources are the safe way to satisfy a multi-count requirement.
   */
  oneTime?: boolean;
  note?: string;
}

export function scopeIncludes(
  scope: ProgressionScope,
  status: ProgressionStatus,
): boolean {
  return scope === "declared" || status === "built";
}

export function nodesInScope(
  nodes: readonly ProgressionNode[],
  scope: ProgressionScope,
): readonly ProgressionNode[] {
  return nodes.filter((node) => scopeIncludes(scope, node.status));
}

// ---------------------------------------------------------------------------
// Guaranteed items (docs/CONTENT_MATRIX.md, "Items", Guaranteed = yes)
// ---------------------------------------------------------------------------

export interface GuaranteedItem {
  itemId: string;
  status: ProgressionStatus;
  /** The matrix row this item belongs to, verbatim, for failure messages. */
  matrixRow: string;
}

/** Sorted by item id. Iteration order is part of the determinism contract. */
export const GUARANTEED_ITEMS: readonly GuaranteedItem[] = [
  {
    itemId: "minecraft:copper_ingot",
    status: "planned",
    matrixRow: "`gold_ingot` (vanilla), `copper_ingot` (vanilla)",
  },
  {
    itemId: "minecraft:gold_ingot",
    status: "planned",
    matrixRow: "`gold_ingot` (vanilla), `copper_ingot` (vanilla)",
  },
  {
    itemId: IDENTIFIERS.aetherCannon,
    status: "built",
    matrixRow: "`aether_cannon`, `cannon_control`, `aether_charge`",
  },
  {
    itemId: IDENTIFIERS.aetherCharge,
    status: "built",
    matrixRow: "`aether_cannon`, `cannon_control`, `aether_charge`",
  },
  {
    itemId: PLANNED_IDENTIFIERS.aetherCore,
    status: "planned",
    matrixRow: "`aether_core`",
  },
  {
    itemId: IDENTIFIERS.aetherCrystal,
    status: "built",
    matrixRow: "`aether_crystal`",
  },
  {
    itemId: IDENTIFIERS.aetherEngine,
    status: "built",
    matrixRow:
      "`reinforced_hull`, `aether_engine`, `cargo_hold`, `navigator_module`",
  },
  {
    itemId: IDENTIFIERS.armoredHull,
    status: "built",
    matrixRow: "`armored_hull`, `frostfire_engine`, `expanded_cargo_hold`",
  },
  {
    itemId: IDENTIFIERS.cannonControl,
    status: "built",
    matrixRow: "`aether_cannon`, `cannon_control`, `aether_charge`",
  },
  {
    itemId: IDENTIFIERS.canvasBundle,
    status: "built",
    matrixRow: "`ship_core`, `canvas_bundle`, `thruster_module`",
  },
  {
    itemId: IDENTIFIERS.cargoHold,
    status: "built",
    matrixRow:
      "`reinforced_hull`, `aether_engine`, `cargo_hold`, `navigator_module`",
  },
  {
    itemId: IDENTIFIERS.expandedCargoHold,
    status: "built",
    matrixRow: "`armored_hull`, `frostfire_engine`, `expanded_cargo_hold`",
  },
  {
    itemId: IDENTIFIERS.frostfireEngine,
    status: "built",
    matrixRow: "`armored_hull`, `frostfire_engine`, `expanded_cargo_hold`",
  },
  {
    itemId: IDENTIFIERS.froststeelIngot,
    status: "built",
    matrixRow: "`froststeel_ingot`",
  },
  {
    itemId: IDENTIFIERS.navigatorModule,
    status: "built",
    matrixRow:
      "`reinforced_hull`, `aether_engine`, `cargo_hold`, `navigator_module`",
  },
  {
    itemId: IDENTIFIERS.raiderCore,
    status: "built",
    matrixRow: "`shield_projector`, `raider_core`",
  },
  {
    itemId: IDENTIFIERS.reinforcedHull,
    status: "built",
    matrixRow:
      "`reinforced_hull`, `aether_engine`, `cargo_hold`, `navigator_module`",
  },
  {
    itemId: PLANNED_IDENTIFIERS.relicShard,
    status: "planned",
    matrixRow: "`relic_shard`",
  },
  {
    itemId: IDENTIFIERS.repairKit,
    status: "built",
    matrixRow: "`repair_kit`",
  },
  {
    itemId: IDENTIFIERS.shieldProjector,
    status: "built",
    matrixRow: "`shield_projector`, `raider_core`",
  },
  {
    itemId: IDENTIFIERS.shipCore,
    status: "built",
    matrixRow: "`ship_core`, `canvas_bundle`, `thruster_module`",
  },
  {
    itemId: IDENTIFIERS.thrusterModule,
    status: "built",
    matrixRow: "`ship_core`, `canvas_bundle`, `thruster_module`",
  },
];

/**
 * Quantity gates the boolean closure cannot express. The closure proves the
 * item is obtainable at all; these rows record how many the design demands and
 * are asserted separately against the number of distinct declared sources.
 */
export interface QuantityGate {
  itemId: string;
  count: number;
  gate: string;
  minimumDistinctSources: number;
}

export const QUANTITY_GATES: readonly QuantityGate[] = [
  {
    itemId: PLANNED_IDENTIFIERS.relicShard,
    count: 2,
    gate: "aether_sanctum access",
    minimumDistinctSources: 2,
  },
  {
    itemId: IDENTIFIERS.canvasBundle,
    count: 2,
    gate: "skiff assembly",
    minimumDistinctSources: 1,
  },
];

// ---------------------------------------------------------------------------
// Islands
// ---------------------------------------------------------------------------

export interface ProgressionIsland {
  id: string;
  /** Minimum ship tier required to arrive; matches `ISLAND_DEFINITIONS`. */
  tier: number;
  status: ProgressionStatus;
  /** Tokens required beyond the tier ship capability. */
  accessRequires: readonly string[];
}

/** Sorted by id. */
export const PROGRESSION_ISLANDS: readonly ProgressionIsland[] = [
  {
    id: "aether_sanctum",
    tier: 3,
    status: "planned",
    accessRequires: [PLANNED_IDENTIFIERS.relicShard],
  },
  { id: "ashfall_crater", tier: 3, status: "planned", accessRequires: [] },
  { id: "ember_outpost", tier: 1, status: "built", accessRequires: [] },
  { id: "frostspire", tier: 2, status: "built", accessRequires: [] },
  { id: "glacier_vault", tier: 3, status: "planned", accessRequires: [] },
  { id: "starter_island", tier: 0, status: "built", accessRequires: [] },
  { id: "sunspire_reach", tier: 1, status: "planned", accessRequires: [] },
  { id: "verdant_hollow", tier: 1, status: "planned", accessRequires: [] },
];

export function progressionIsland(id: string): ProgressionIsland {
  const island = PROGRESSION_ISLANDS.find((candidate) => candidate.id === id);

  if (island === undefined) {
    throw new Error(`Unknown Sky Knights progression island ${id}.`);
  }

  return island;
}

/**
 * Travel rules, derived so an island can never claim a tier gate that
 * disagrees with `PROGRESSION_ISLANDS`. Tier 0 is the home island, reached by
 * the `start:home` rule instead.
 */
const TRAVEL_NODES: readonly ProgressionNode[] = PROGRESSION_ISLANDS.filter(
  (island) => island.tier > 0,
).map((island) => ({
  id: `travel:${island.id}`,
  kind: "travel",
  status: island.status,
  requires: [shipTokenForTier(island.tier), ...island.accessRequires],
  grants: [islandAccessToken(island.id)],
  island: island.id,
}));

// ---------------------------------------------------------------------------
// Recipe ingredient tags
// ---------------------------------------------------------------------------

/**
 * Item tags used by `behavior_packs/sk_bp/recipes/*.json`, resolved to the
 * concrete items this graph can actually produce.
 */
export const RECIPE_TAG_ITEMS: Readonly<Record<string, readonly string[]>> = {
  "minecraft:planks": ["minecraft:oak_planks"],
};

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const HOME = islandAccessToken("starter_island");
const TABLE = "minecraft:crafting_table";

const BASE_NODES: readonly ProgressionNode[] = [
  {
    id: "start:home",
    kind: "start",
    status: "built",
    requires: [],
    grants: [HOME],
    island: "starter_island",
    note: "A fresh player spawns on the home island holding nothing.",
  },

  // Home island harvesting. `tools/structures/starter_island.mjs` bakes oak
  // logs plus coal and iron ore pockets into the body.
  {
    id: "mine:starter_island/oak_log",
    kind: "mine",
    status: "built",
    requires: [HOME],
    grants: ["minecraft:oak_log"],
    island: "starter_island",
  },
  {
    id: "mine:starter_island/cobblestone",
    kind: "mine",
    status: "built",
    requires: [HOME],
    grants: ["minecraft:cobblestone"],
    island: "starter_island",
  },
  {
    id: "mine:starter_island/coal",
    kind: "mine",
    status: "built",
    requires: [HOME],
    grants: ["minecraft:coal"],
    island: "starter_island",
  },
  {
    id: "mine:starter_island/raw_iron",
    kind: "mine",
    status: "built",
    requires: [HOME],
    grants: ["minecraft:raw_iron"],
    island: "starter_island",
  },

  // Vanilla intermediates. Two-by-two grid recipes need no crafting table.
  {
    id: "craft:minecraft:oak_planks",
    kind: "craft",
    status: "built",
    requires: ["minecraft:oak_log"],
    grants: ["minecraft:oak_planks"],
  },
  {
    id: "craft:minecraft:stick",
    kind: "craft",
    status: "built",
    requires: ["minecraft:oak_planks"],
    grants: ["minecraft:stick"],
  },
  {
    id: "craft:minecraft:crafting_table",
    kind: "craft",
    status: "built",
    requires: ["minecraft:oak_planks"],
    grants: [TABLE],
  },
  {
    id: "craft:minecraft:furnace",
    kind: "craft",
    status: "built",
    requires: [TABLE, "minecraft:cobblestone"],
    grants: ["minecraft:furnace"],
  },
  {
    id: "craft:minecraft:chest",
    kind: "craft",
    status: "built",
    requires: [TABLE, "minecraft:oak_planks"],
    grants: ["minecraft:chest"],
  },
  {
    id: "craft:minecraft:compass",
    kind: "craft",
    status: "built",
    requires: [TABLE, "minecraft:iron_ingot", "minecraft:redstone"],
    grants: ["minecraft:compass"],
  },
  {
    id: "smelt:minecraft:iron_ingot",
    kind: "smelt",
    status: "built",
    requires: ["minecraft:furnace", "minecraft:raw_iron", "minecraft:coal"],
    grants: ["minecraft:iron_ingot"],
  },

  // Add-on recipes. Each id is `craft:<recipe identifier>` and the closure test
  // cross-checks requires/grants against behavior_packs/sk_bp/recipes/*.json.
  {
    id: `craft:${IDENTIFIERS.shipCore}`,
    kind: "craft",
    status: "built",
    requires: [TABLE, "minecraft:iron_ingot", "minecraft:coal"],
    grants: [IDENTIFIERS.shipCore],
  },
  {
    id: `craft:${IDENTIFIERS.canvasBundle}`,
    kind: "craft",
    status: "built",
    requires: [TABLE, "minecraft:oak_planks", "minecraft:stick"],
    grants: [IDENTIFIERS.canvasBundle],
  },
  {
    id: `craft:${IDENTIFIERS.thrusterModule}`,
    kind: "craft",
    status: "built",
    requires: [
      TABLE,
      "minecraft:iron_ingot",
      "minecraft:coal",
      "minecraft:cobblestone",
    ],
    grants: [IDENTIFIERS.thrusterModule],
  },
  {
    id: `craft:${IDENTIFIERS.reinforcedHull}`,
    kind: "craft",
    status: "built",
    requires: [TABLE, "minecraft:iron_ingot", IDENTIFIERS.canvasBundle],
    grants: [IDENTIFIERS.reinforcedHull],
  },
  {
    id: `craft:${IDENTIFIERS.cargoHold}`,
    kind: "craft",
    status: "built",
    requires: [TABLE, "minecraft:iron_ingot", "minecraft:chest"],
    grants: [IDENTIFIERS.cargoHold],
  },
  {
    id: `craft:${IDENTIFIERS.navigatorModule}`,
    kind: "craft",
    status: "built",
    requires: [TABLE, "minecraft:emerald", "minecraft:compass"],
    grants: [IDENTIFIERS.navigatorModule],
  },
  {
    id: `craft:${IDENTIFIERS.repairKit}`,
    kind: "craft",
    status: "built",
    requires: [TABLE, "minecraft:iron_ingot", IDENTIFIERS.canvasBundle],
    grants: [IDENTIFIERS.repairKit],
  },
  {
    id: `craft:${IDENTIFIERS.armoredHull}`,
    kind: "craft",
    status: "built",
    requires: [
      TABLE,
      IDENTIFIERS.froststeelIngot,
      "minecraft:iron_ingot",
      IDENTIFIERS.canvasBundle,
    ],
    grants: [IDENTIFIERS.armoredHull],
  },
  {
    id: `craft:${IDENTIFIERS.frostfireEngine}`,
    kind: "craft",
    status: "built",
    requires: [
      TABLE,
      IDENTIFIERS.froststeelIngot,
      "minecraft:redstone",
      IDENTIFIERS.thrusterModule,
    ],
    grants: [IDENTIFIERS.frostfireEngine],
  },
  {
    id: `craft:${IDENTIFIERS.expandedCargoHold}`,
    kind: "craft",
    status: "built",
    requires: [
      TABLE,
      IDENTIFIERS.froststeelIngot,
      "minecraft:iron_ingot",
      "minecraft:chest",
    ],
    grants: [IDENTIFIERS.expandedCargoHold],
  },
  {
    id: `craft:${IDENTIFIERS.aetherCannon}`,
    kind: "craft",
    status: "built",
    requires: [
      TABLE,
      IDENTIFIERS.froststeelIngot,
      "minecraft:iron_ingot",
      "minecraft:compass",
      "minecraft:redstone",
    ],
    grants: [IDENTIFIERS.aetherCannon],
  },
  {
    id: `craft:${IDENTIFIERS.aetherCharge}`,
    kind: "craft",
    status: "built",
    requires: [TABLE, "minecraft:coal", "minecraft:iron_ingot"],
    grants: [IDENTIFIERS.aetherCharge],
  },

  // Dockyard assembly and refit (scripts/gameplay/dockyard.ts).
  {
    id: "assembly:skiff",
    kind: "assembly",
    status: "built",
    requires: [
      HOME,
      IDENTIFIERS.shipCore,
      IDENTIFIERS.canvasBundle,
      IDENTIFIERS.thrusterModule,
    ],
    grants: [shipTokenForTier(1)],
    island: "starter_island",
    note: "DOCKYARD.assemblyRequirements; canvas bundle count is a QUANTITY_GATE.",
  },
  {
    id: "assembly:skycutter",
    kind: "assembly",
    status: "built",
    requires: [
      HOME,
      `${UNLOCK_PREFIX}skycutter_blueprint`,
      IDENTIFIERS.reinforcedHull,
      IDENTIFIERS.aetherEngine,
      IDENTIFIERS.cargoHold,
      IDENTIFIERS.navigatorModule,
    ],
    grants: [shipTokenForTier(2)],
    island: "starter_island",
    note: "DOCKYARD.skycutterRequirements.",
  },
  {
    id: "assembly:skycutter_refit",
    kind: "assembly",
    status: "built",
    requires: [
      HOME,
      shipTokenForTier(2),
      IDENTIFIERS.armoredHull,
      IDENTIFIERS.frostfireEngine,
      IDENTIFIERS.expandedCargoHold,
    ],
    grants: [shipTokenForTier(3)],
    island: "starter_island",
    note: "Tier 3 is a Froststeel-refit Skycutter (content matrix, islands table).",
  },

  // Guaranteed island loot (scripts/generation/content.ts).
  {
    id: "loot:ember_outpost",
    kind: "loot",
    status: "built",
    requires: [islandAccessToken("ember_outpost")],
    grants: [
      IDENTIFIERS.aetherCrystal,
      "minecraft:emerald",
      "minecraft:iron_ingot",
      "minecraft:redstone",
      "minecraft:cooked_beef",
    ],
    island: "ember_outpost",
    oneTime: true,
    note: "prepareEmberLoot: 1 crystal, 3 emerald, 24 iron, 8 cooked beef, 8 redstone.",
  },
  {
    id: "loot:frostspire",
    kind: "loot",
    status: "built",
    requires: [islandAccessToken("frostspire")],
    grants: [
      IDENTIFIERS.froststeelIngot,
      "minecraft:diamond",
      "minecraft:arrow",
      "minecraft:cooked_salmon",
    ],
    island: "frostspire",
    oneTime: true,
    note: "prepareFrostspireLoot: 16 froststeel, 2 diamond, 24 arrow, 8 cooked salmon.",
  },

  // Encounters (scripts/gameplay/sky-raider.ts, generation/content.ts).
  {
    id: "encounter:ember_guardian",
    kind: "encounter",
    status: "built",
    requires: [islandAccessToken("ember_outpost")],
    grants: ["minecraft:rotten_flesh"],
    island: "ember_outpost",
    note: "minecraft:husk, vanilla drops.",
  },
  {
    id: "encounter:frostspire_warden",
    kind: "encounter",
    status: "built",
    requires: [islandAccessToken("frostspire")],
    grants: ["minecraft:bone", "minecraft:arrow"],
    island: "frostspire",
    note: "minecraft:stray, vanilla drops.",
  },
  {
    id: "encounter:sky_raider",
    kind: "encounter",
    status: "built",
    requires: [
      shipTokenForTier(2),
      IDENTIFIERS.aetherCannon,
      IDENTIFIERS.cannonControl,
      IDENTIFIERS.aetherCharge,
    ],
    grants: [IDENTIFIERS.raiderCore],
    note: "Activates only for a cannon-equipped Skycutter; the core is a guaranteed drop.",
  },

  // Dockmaster awards (scripts/gameplay/dockyard.ts).
  {
    id: "npc_award:aether_engine",
    kind: "npc_award",
    status: "built",
    requires: [HOME, IDENTIFIERS.aetherCrystal],
    grants: [IDENTIFIERS.aetherEngine, `${UNLOCK_PREFIX}skycutter_blueprint`],
    island: "starter_island",
    note: "returnAetherCrystal consumes the crystal and unlocks the Skycutter.",
  },
  {
    id: "npc_award:repair_kit",
    kind: "npc_award",
    status: "built",
    requires: [HOME, IDENTIFIERS.froststeelIngot],
    grants: [IDENTIFIERS.repairKit],
    island: "starter_island",
    note: "returnFrostCargo awards two Repair Kits.",
  },
  {
    id: "npc_award:cannon_control",
    kind: "npc_award",
    status: "built",
    requires: [HOME, shipTokenForTier(2), IDENTIFIERS.aetherCannon],
    grants: [IDENTIFIERS.cannonControl],
    island: "starter_island",
    note: "issueCannonControl during the combat refit; reissued if lost.",
  },
  {
    id: "npc_award:shield_projector",
    kind: "npc_award",
    status: "built",
    requires: [HOME, IDENTIFIERS.raiderCore],
    grants: [IDENTIFIERS.shieldProjector],
    island: "starter_island",
    note: "returnRaiderCore converts the core into a Shield Projector.",
  },

  // ---------------------------------------------------------------------
  // Planned content. Declared so the intended 1.0 ladder can be proven
  // closed; excluded from the `built` scope so it can never mask a hole.
  // ---------------------------------------------------------------------
  {
    id: "loot:sunspire_reach",
    kind: "loot",
    status: "planned",
    requires: [islandAccessToken("sunspire_reach")],
    grants: ["minecraft:gold_ingot", "minecraft:copper_ingot"],
    island: "sunspire_reach",
    oneTime: true,
    note: "Matrix: 16 gold ingot, 8 copper. No implementing source yet.",
  },
  {
    id: "mine:sunspire_reach/ore",
    kind: "mine",
    status: "planned",
    requires: [islandAccessToken("sunspire_reach"), "minecraft:furnace"],
    grants: ["minecraft:gold_ingot", "minecraft:copper_ingot"],
    island: "sunspire_reach",
    note: "Desert family ore table: repeatable gold/copper, unlike the hut chest.",
  },
  {
    id: "loot:verdant_hollow",
    kind: "loot",
    status: "planned",
    requires: [islandAccessToken("verdant_hollow")],
    grants: [IDENTIFIERS.repairKit, "minecraft:oak_sapling"],
    island: "verdant_hollow",
    oneTime: true,
    note: "Matrix: 1 Repair Kit, saplings.",
  },
  {
    id: "mine:verdant_hollow/oak_log",
    kind: "mine",
    status: "planned",
    requires: [islandAccessToken("verdant_hollow")],
    grants: ["minecraft:oak_log"],
    island: "verdant_hollow",
    note: "Renewable wood, the matrix purpose for this island.",
  },
  {
    id: "loot:glacier_vault",
    kind: "loot",
    status: "planned",
    requires: [islandAccessToken("glacier_vault")],
    grants: ["minecraft:diamond", PLANNED_IDENTIFIERS.relicShard],
    island: "glacier_vault",
    oneTime: true,
    note: "Matrix: 4 diamond, 1 Relic Shard.",
  },
  {
    id: "loot:ashfall_crater",
    kind: "loot",
    status: "planned",
    requires: [islandAccessToken("ashfall_crater")],
    grants: [IDENTIFIERS.aetherCrystal, PLANNED_IDENTIFIERS.relicShard],
    island: "ashfall_crater",
    oneTime: true,
    note: "Matrix: 2 Aether Crystal, 1 Relic Shard.",
  },
  {
    id: "encounter:aether_sanctum_giant",
    kind: "encounter",
    status: "planned",
    requires: [islandAccessToken("aether_sanctum")],
    grants: [PLANNED_IDENTIFIERS.aetherCore],
    island: "aether_sanctum",
    note: "skyknights:giant boss drop; the 1.0 completion objective.",
  },
  {
    id: "encounter:goblin",
    kind: "encounter",
    status: "planned",
    requires: [islandAccessToken("sunspire_reach")],
    grants: ["minecraft:gold_nugget"],
    island: "sunspire_reach",
    note: "Matrix creature row: gold nugget, cloth.",
  },
  {
    id: "encounter:yeti",
    kind: "encounter",
    status: "planned",
    requires: [islandAccessToken("glacier_vault")],
    grants: [IDENTIFIERS.froststeelIngot],
    island: "glacier_vault",
    note: "Matrix creature row: froststeel ingot. A repeatable froststeel source.",
  },
  {
    id: "encounter:demon",
    kind: "encounter",
    status: "planned",
    requires: [islandAccessToken("ashfall_crater")],
    grants: ["minecraft:blaze_rod"],
    island: "ashfall_crater",
    note: "Matrix creature row: aether shard, blaze rod.",
  },
  {
    id: "encounter:hedgehog",
    kind: "encounter",
    status: "planned",
    requires: [islandAccessToken("verdant_hollow")],
    grants: ["minecraft:leather"],
    island: "verdant_hollow",
    note: "Matrix creature row: leather, ambient.",
  },
];

/** Every declared rule. Order is stable and part of the test contract. */
export const PROGRESSION_NODES: readonly ProgressionNode[] = [
  ...BASE_NODES,
  ...TRAVEL_NODES,
];

/**
 * Guaranteed items that no `built` rule can yield today. Every entry must be a
 * `planned` matrix row. The test asserts the real gap is a SUBSET of this list,
 * so the suite turns green as Phase 4 lands each source and fails loudly if a
 * new gap appears.
 */
export const PENDING_GUARANTEED_ITEMS: readonly string[] = [
  "minecraft:copper_ingot",
  "minecraft:gold_ingot",
  PLANNED_IDENTIFIERS.aetherCore,
  PLANNED_IDENTIFIERS.relicShard,
];

// ---------------------------------------------------------------------------
// Closure
// ---------------------------------------------------------------------------

export interface ClosureResult {
  /** Every token a player can eventually hold. */
  tokens: ReadonlySet<string>;
  /** Rules that fired, in the order the closure applied them. */
  appliedNodeIds: readonly string[];
  /** First rule that yielded each token, for readable derivations. */
  grantedBy: ReadonlyMap<string, string>;
}

/**
 * Start holding nothing, then apply every rule whose requirements are already
 * satisfied, repeatedly, until the reachable set stops growing.
 */
export function deriveClosure(
  nodes: readonly ProgressionNode[],
): ClosureResult {
  const tokens = new Set<string>();
  const grantedBy = new Map<string, string>();
  const appliedNodeIds: string[] = [];
  const applied = new Set<string>();
  let growing = true;

  while (growing) {
    growing = false;

    for (const node of nodes) {
      if (applied.has(node.id)) {
        continue;
      }

      if (!node.requires.every((requirement) => tokens.has(requirement))) {
        continue;
      }

      applied.add(node.id);
      appliedNodeIds.push(node.id);
      growing = true;

      for (const grant of node.grants) {
        if (!tokens.has(grant)) {
          tokens.add(grant);
          grantedBy.set(grant, node.id);
        }
      }
    }
  }

  return { tokens, appliedNodeIds, grantedBy };
}

export function reachableTokens(
  nodes: readonly ProgressionNode[],
  scope: ProgressionScope,
): ReadonlySet<string> {
  return deriveClosure(nodesInScope(nodes, scope)).tokens;
}

export function nodesGranting(
  nodes: readonly ProgressionNode[],
  token: string,
): readonly ProgressionNode[] {
  return nodes.filter((node) => node.grants.includes(token));
}

export function withoutNodes(
  nodes: readonly ProgressionNode[],
  removedIds: readonly string[],
): readonly ProgressionNode[] {
  for (const removedId of removedIds) {
    if (!nodes.some((node) => node.id === removedId)) {
      throw new Error(`Cannot remove unknown progression rule ${removedId}.`);
    }
  }

  return nodes.filter((node) => !removedIds.includes(node.id));
}

/**
 * The rule chain that yields `token`, dependencies first. Used to explain a
 * closure result in a failure message.
 */
export function derivationFor(
  nodes: readonly ProgressionNode[],
  result: ClosureResult,
  token: string,
): readonly string[] {
  const chain: string[] = [];
  const seen = new Set<string>();

  const visit = (current: string): void => {
    const nodeId = result.grantedBy.get(current);

    if (nodeId === undefined || seen.has(nodeId)) {
      return;
    }

    seen.add(nodeId);
    const node = nodes.find((candidate) => candidate.id === nodeId);

    for (const requirement of node?.requires ?? []) {
      visit(requirement);
    }

    chain.push(nodeId);
  };

  visit(token);
  return chain;
}

// ---------------------------------------------------------------------------
// Ordering and cycle analysis
// ---------------------------------------------------------------------------

export interface GateCycleStep {
  token: string;
  /** Rule that would have to yield the previous token. */
  viaNodeId: string;
}

export interface GateCycle {
  token: string;
  steps: readonly GateCycleStep[];
}

export function formatGateCycle(cycle: GateCycle): string {
  const path = cycle.steps.map((step) => `[${step.viaNodeId}] ${step.token}`);
  return [cycle.token, ...path, cycle.token].join(" -> ");
}

/**
 * Walk the BLOCKING requirement graph of an unreachable token and report the
 * first circular gate: a token whose only sources transitively require the
 * token itself.
 *
 * Only requirements that the closure cannot already satisfy are followed. A
 * cycle among already-reachable tokens is benign — an alternative source
 * exists — and reporting it would be noise. Returns undefined when the token
 * is reachable, or when it is simply missing a source rather than gated on
 * itself.
 */
export function findGateCycle(
  nodes: readonly ProgressionNode[],
  token: string,
  reachable?: ReadonlySet<string>,
): GateCycle | undefined {
  const satisfied = reachable ?? deriveClosure(nodes).tokens;

  if (satisfied.has(token)) {
    return undefined;
  }

  const stack: GateCycleStep[] = [];
  const onStack = new Set<string>();
  const settled = new Set<string>();

  const visit = (current: string): GateCycle | undefined => {
    if (onStack.has(current)) {
      const start = stack.findIndex((step) => step.token === current);
      return { token: current, steps: stack.slice(start + 1) };
    }

    if (settled.has(current)) {
      return undefined;
    }

    onStack.add(current);

    for (const node of nodesGranting(nodes, current)) {
      for (const requirement of node.requires) {
        if (satisfied.has(requirement)) {
          continue;
        }

        stack.push({ token: requirement, viaNodeId: node.id });
        const cycle = visit(requirement);

        if (cycle !== undefined) {
          return cycle;
        }

        stack.pop();
      }
    }

    onStack.delete(current);
    settled.add(current);
    return undefined;
  };

  stack.push({ token, viaNodeId: "(target)" });
  return visit(token);
}

export interface IslandGateFailure {
  islandId: string;
  reason: string;
}

/**
 * Ordering constraint from the roadmap: no island may be gated, transitively,
 * on an item that only that island yields. Proven by recomputing the closure
 * with all of the island's own yields removed and checking its access token is
 * still reachable.
 */
export function islandSelfGateFailures(
  nodes: readonly ProgressionNode[],
  scope: ProgressionScope,
): readonly IslandGateFailure[] {
  const failures: IslandGateFailure[] = [];
  const scoped = nodesInScope(nodes, scope);

  for (const island of PROGRESSION_ISLANDS) {
    if (!scopeIncludes(scope, island.status)) {
      continue;
    }

    const withoutYields = scoped.filter(
      (node) =>
        node.island !== island.id ||
        node.kind === "travel" ||
        node.kind === "start",
    );
    const accessToken = islandAccessToken(island.id);
    const closure = deriveClosure(withoutYields);

    if (closure.tokens.has(accessToken)) {
      continue;
    }

    const cycle = findGateCycle(withoutYields, accessToken, closure.tokens);
    failures.push({
      islandId: island.id,
      reason:
        cycle === undefined
          ? `${accessToken} is unreachable without ${island.id}'s own yields.`
          : `${accessToken} is circularly gated: ${formatGateCycle(cycle)}`,
    });
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Assertions the test drives
// ---------------------------------------------------------------------------

export function guaranteedItemsInScope(
  scope: ProgressionScope,
): readonly GuaranteedItem[] {
  return GUARANTEED_ITEMS.filter((item) => scopeIncludes(scope, item.status));
}

/** Guaranteed items the closure cannot reach. Empty means the game is closed. */
export function missingGuaranteedItems(
  nodes: readonly ProgressionNode[],
  scope: ProgressionScope,
): readonly string[] {
  const reachable = reachableTokens(nodes, scope);
  return guaranteedItemsInScope(scope)
    .map((item) => item.itemId)
    .filter((itemId) => !reachable.has(itemId))
    .sort();
}

/** Guaranteed items no shipping rule yields yet. A real content gap. */
export function guaranteedItemsWithoutBuiltSource(
  nodes: readonly ProgressionNode[],
): readonly string[] {
  const built = nodesInScope(nodes, "built");
  return GUARANTEED_ITEMS.map((item) => item.itemId)
    .filter((itemId) => nodesGranting(built, itemId).length === 0)
    .sort();
}

/**
 * Tokens whose only sources are one-time chests. Depending on one of these for
 * a guaranteed item means a lost stack is a soft lock, so the list is asserted
 * against a documented set rather than left to drift.
 */
export function oneTimeOnlyTokens(
  nodes: readonly ProgressionNode[],
  scope: ProgressionScope,
): readonly string[] {
  const scoped = nodesInScope(nodes, scope);
  const tokens = new Set<string>();

  for (const node of scoped) {
    for (const grant of node.grants) {
      tokens.add(grant);
    }
  }

  return [...tokens]
    .filter((token) =>
      nodesGranting(scoped, token).every((node) => node.oneTime === true),
    )
    .sort();
}
