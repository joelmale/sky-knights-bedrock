# Content Matrix

Authoritative 1.0 content contract. Roadmap phases 3–6 are complete when every
row here is `built` and `npm run verify` passes.

Rules:

- Built identifiers are `skyknights:`-namespaced, added to the applicable
  registry, and asserted by `scripts/bootstrap/validation.ts` or a host-side
  content-contract test.
- Never rename or reuse a shipped identifier. Add a new one instead.
- Every row with `Guaranteed = yes` must be reachable without random loot and is
  covered by the progression-closure test in `tests/progression-closure.test.ts`.
- `Status` values: `built`, `partial`, `planned`.

## Island families

Four families. Each family owns a block palette, ore table, structure pool, and
encounter table.

| Family | Palette anchor | Signature resource | Status |
| --- | --- | --- | --- |
| `verdant` | grass/dirt/oak | oak log, coal, iron | built |
| `volcanic` | blackstone/netherrack/basalt | iron, redstone, aether crystal | built |
| `tundra` | snow/packed ice/spruce | froststeel, diamond | built |
| `desert` | sandstone/sand/terracotta | gold, copper | partial |

## Islands

`Tier` is the minimum ship tier required to arrive safely. Tier 0 is the home
island, tier 1 the starter skiff, tier 2 the Skycutter, tier 3 a refit
Skycutter.

| Island id | Family | Tier | Purpose | Guaranteed reward | Status |
| --- | --- | ---: | --- | --- | --- |
| `starter_island` | verdant | 0 | Home, dock, Dockmaster, wood/stone/iron | ship part materials | built |
| `ember_outpost` | volcanic | 1 | First expedition, ruin, guardian | 1 Aether Crystal, 24 iron, 8 redstone | built |
| `frostspire` | tundra | 2 | Range-gated raid, warden | 16 Froststeel, 2 diamond | built |
| `sunspire_reach` | desert | 1 | Structure built; gold/metal tier, hut content, and goblins inactive | 16 gold ingot, 8 copper | partial |
| `verdant_hollow` | verdant | 1 | Structure built; renewable-wood content and passive fauna inactive | 1 Repair Kit, saplings | partial |
| `glacier_vault` | tundra | 3 | Structure built; watchtower, Yeti, and reward content inactive | 4 diamond, 1 Relic Shard | partial |
| `ashfall_crater` | volcanic | 3 | Structure built; Demon, shrine, and reward content inactive | 2 Aether Crystal, 1 Relic Shard | partial |
| `aether_sanctum` | desert | 3 | Structure built; boss encounter and completion objective inactive | 1 Aether Core, Giant boss loot | partial |

Layout rule: the three released islands retain their pinned coordinates; seeded
island centers come from the deterministic layout registry. Travel lanes
between consecutive tiers stay clear of all reserved bounds.

## Creatures

Passive creatures never carry hostile components. No ordinary enemy may exceed
`maxHealthDamage` such that it one-shots a full-health unarmored player.

| Identifier | Role | Family | Health | Attack | Drop | Status |
| --- | --- | --- | ---: | ---: | --- | --- |
| `minecraft:husk` | Ember guardian (reskin-free) | volcanic | vanilla | vanilla | vanilla | built |
| `minecraft:stray` | Frostspire warden | tundra | vanilla | vanilla | vanilla | built |
| `skyknights:sky_raider` | Airship encounter | air | 120 | ranged | Raider Core | built |
| `skyknights:hedgehog` | Passive ambient | verdant | 8 | 0 | leather, ambient | planned |
| `skyknights:goblin` | Early melee | desert/verdant | 20 | 3 | gold nugget, cloth | planned |
| `skyknights:yeti` | Heavy melee | tundra | 60 | 7 | froststeel ingot | planned |
| `skyknights:demon` | Elite | volcanic | 80 | 9 | aether shard, blaze rod | planned |
| `skyknights:giant` | Boss-class | sanctum | 250 | 12 | Aether Core, relic | planned |

## NPCs

Non-combat. Dialogue must work on keyboard, controller, and touch. NPCs do not
share enemy health or loot families.

| Identifier | Role | Location | Status |
| --- | --- | --- | --- |
| `skyknights:dockmaster` | Ship assembly, refit, travel briefing | starter dock | built |
| `skyknights:smith` | Tool and weapon progression guidance | starter island | planned |
| `skyknights:cartographer` | Reveals and describes destinations | starter island | planned |
| `skyknights:lorekeeper` | Flavor and late-game direction | aether_sanctum approach | planned |

## Structures

| Structure | Contents | Placement | Status |
| --- | --- | --- | --- |
| Starter dock/workshop | dock, Dockmaster, launch berths | starter_island | built |
| Small ruin | loot chest, guardian | ember_outpost | built |
| Frost tower | loot chest, warden | frostspire | built |
| Wood hut | geometry built; tier-1 chest content inactive | sunspire_reach, verdant_hollow | partial |
| Watchtower | geometry built; encounter and chest content inactive | glacier_vault | partial |
| Biome shrine | geometry built; relic and ambient content inactive | ashfall_crater | partial |
| Boss arena | geometry built; Giant and completion objective inactive | aether_sanctum | partial |

## Items

| Identifier | Purpose | Guaranteed | Status |
| --- | --- | --- | --- |
| `ship_core`, `canvas_bundle`, `thruster_module` | Starter skiff | yes | built |
| `aether_crystal` | Skycutter unlock | yes | built |
| `reinforced_hull`, `aether_engine`, `cargo_hold`, `navigator_module` | Skycutter base loadout | yes | built |
| `repair_kit` | Repair and reconstruction | yes | built |
| `froststeel_ingot` | Advanced module input | yes | built |
| `armored_hull`, `frostfire_engine`, `expanded_cargo_hold` | Refit modules | yes | built |
| `aether_cannon`, `cannon_control`, `aether_charge` | Offense utility | yes | built |
| `shield_projector`, `raider_core` | Defense utility | yes | built |
| `gold_ingot` (vanilla), `copper_ingot` (vanilla) | Desert metal tier | yes | planned |
| `relic_shard` | Tier-3 unlock currency, 2 required | yes | planned |
| `aether_core` | Endgame ship/objective item | yes | planned |
| `skyblade`, `frostbrand`, `emberfang`, `aetherpiercer` | Curated named weapons | no | planned |

## Loot tables

`behavior_packs/sk_bp/loot_tables/` is currently empty; guaranteed loot is
script-placed. Ordinary container and mob drops move to JSON loot tables.
Guaranteed progression items stay script-placed and idempotent.

| Table | Use | Status |
| --- | --- | --- |
| `entities/hedgehog`, `goblin`, `yeti`, `demon`, `giant` | Mob drops | planned |
| `chests/hut_tier1`, `chests/watchtower_tier2`, `chests/shrine_tier3` | Structure chests | planned |

Multiplayer policy: structure chests are shared and one-time. Guaranteed
progression items are placed once per island content version and are not
refilled per player.

## Progression ladder

Closure test asserts every `Guaranteed = yes` item is reachable from a fresh
world holding nothing.

| Tier | Source | Unlocks |
| --- | --- | --- |
| Wood | starter_island trees | starter tools, dock repair |
| Stone | starter_island stone | furnace, basic ship parts |
| Iron | starter_island ore | Ship Core, skiff |
| Gold/copper | sunspire_reach | stronger weapons, faster frame |
| Aether crystal | ember_outpost | Skycutter |
| Froststeel | frostspire | refit modules |
| Diamond | glacier_vault, ashfall_crater | final tools, relic access |
| Relic shard ×2 | glacier_vault, ashfall_crater | aether_sanctum access |
| Aether core | aether_sanctum boss | completion objective |

## Localization

Every built custom entity and item above has an `en_US.lang` entry in
`resource_packs/sk_rp/texts/en_US.lang`. A host-side test asserts that no
shipped custom entity or item is missing a display name. Planned identifiers
are not added to executable registries or localization until their assets ship.
