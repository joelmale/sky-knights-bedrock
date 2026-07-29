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

| Family     | Palette anchor               | Signature resource             | Status  |
| ---------- | ---------------------------- | ------------------------------ | ------- |
| `verdant`  | grass/dirt/oak               | oak log, coal, iron            | built   |
| `volcanic` | blackstone/netherrack/basalt | iron, redstone, aether crystal | built   |
| `tundra`   | snow/packed ice/spruce       | froststeel, diamond            | built   |
| `desert`   | sandstone/sand/terracotta    | gold, copper                   | partial |

## Islands

`Tier` is the minimum travel capability required to arrive safely. In the
shipping ladder, tier 1 is the starter Skiff, tier 2 the Skycutter, and tier 3 a
refit Skycutter. In the planned custom ladder, those map to Apprentice Raft,
Ember Skiff, and Specialist Airframe. Expedition and Masterwork certifications
remain tier 3 and add capacity/specialization rather than unlocking otherwise
unreachable Relic sources.

| Island id        | Family   | Tier | Purpose                                                                                                             | Guaranteed reward                                   | Status |
| ---------------- | -------- | ---: | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------ |
| `starter_island` | verdant  |    0 | Home, dock, Dockmaster, 4 oak trees, 6 visible surface ore columns, 10-block stone boulder, crafting table, furnace | 2.5x the raw resources the first-skiff route spends | built  |
| `ember_outpost`  | volcanic |    1 | First expedition, ruin, guardian                                                                                    | 1 Aether Crystal, 24 iron, 8 redstone               | built  |
| `frostspire`     | tundra   |    2 | Range-gated raid, warden                                                                                            | 16 Froststeel, 2 diamond                            | built  |
| `sunspire_reach` | desert   |    1 | Seeded structure and guaranteed Balloonwright metal cache; custom goblins remain later                              | 16 gold ingot, 8 copper                             | built  |
| `verdant_hollow` | verdant  |    1 | Seeded structure and guaranteed wood/Canvas cache; passive fauna remain later                                       | 1 Repair Kit, saplings, Canvas Bundles              | built  |
| `glacier_vault`  | tundra   |    3 | Seeded watchtower and guaranteed Frostwright/relic cache; custom Yeti remains later                                 | 4 diamond, 1 Relic Shard                            | built  |
| `ashfall_crater` | volcanic |    3 | Seeded shrine and guaranteed relic cache; custom Demon remains later                                                | 2 Aether Crystal, 1 Relic Shard                     | built  |
| `aether_sanctum` | desert   |    3 | Seeded arena and guaranteed completion cache; custom Giant remains later                                            | 1 Aether Core                                       | built  |

Layout rule: the three released islands retain their pinned coordinates; seeded
island centers come from the deterministic layout registry. Travel lanes
between consecutive tiers stay clear of all reserved bounds.

## Creatures

Passive creatures never carry hostile components. No ordinary enemy may exceed
`maxHealthDamage` such that it one-shots a full-health unarmored player.

| Identifier              | Role                         | Family         |  Health |  Attack | Drop                    | Status  |
| ----------------------- | ---------------------------- | -------------- | ------: | ------: | ----------------------- | ------- |
| `minecraft:husk`        | Ember guardian (reskin-free) | volcanic       | vanilla | vanilla | vanilla                 | built   |
| `minecraft:stray`       | Frostspire warden            | tundra         | vanilla | vanilla | vanilla                 | built   |
| `skyknights:sky_raider` | Airship encounter            | air            |     120 |  ranged | Raider Core             | built   |
| `skyknights:hedgehog`   | Passive ambient              | verdant        |       8 |       0 | leather, ambient        | planned |
| `skyknights:goblin`     | Early melee                  | desert/verdant |      20 |       3 | gold nugget, cloth      | planned |
| `skyknights:yeti`       | Heavy melee                  | tundra         |      60 |       7 | froststeel ingot        | planned |
| `skyknights:demon`      | Elite                        | volcanic       |      80 |       9 | aether shard, blaze rod | planned |
| `skyknights:giant`      | Boss-class                   | sanctum        |     250 |      12 | Aether Core, relic      | planned |

## NPCs

Non-combat. Dialogue must work on keyboard, controller, and touch. NPCs do not
share enemy health or loot families.

| Identifier                | Role                                  | Location                | Status  |
| ------------------------- | ------------------------------------- | ----------------------- | ------- |
| `skyknights:dockmaster`   | Ship assembly, refit, travel briefing | starter dock            | built   |
| `skyknights:smith`        | Tool and weapon progression guidance  | starter island          | planned |
| `skyknights:cartographer` | Reveals and describes destinations    | starter island          | planned |
| `skyknights:lorekeeper`   | Flavor and late-game direction        | aether_sanctum approach | planned |

## Structures

| Structure                  | Contents                                                                                                                                                | Placement                          | Status  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------- |
| Starter dock/workshop      | dock, Dockmaster, launch berths, crafting table, furnace                                                                                                | starter_island                     | built   |
| Small ruin                 | loot chest, guardian                                                                                                                                    | ember_outpost                      | built   |
| Frost tower                | loot chest, warden                                                                                                                                      | frostspire                         | built   |
| Wood hut                   | geometry built; tier-1 chest content inactive                                                                                                           | sunspire_reach, verdant_hollow     | partial |
| Watchtower                 | geometry built; encounter and chest content inactive                                                                                                    | glacier_vault                      | partial |
| Biome shrine               | geometry built; relic and ambient content inactive                                                                                                      | ashfall_crater                     | partial |
| Boss arena                 | geometry built; Giant and completion objective inactive                                                                                                 | aether_sanctum                     | partial |
| Large ambient solo islands | 9.15–11.09× usable-area Islet, Standard, Crag, and Landmark family templates without progression loot or entities                                       | `a3` Fibonacci-annulus archipelago | built   |
| Legacy ambient variants    | run-2 small tiers and rare volcanic burn variants retained for existing terrain and interrupted jobs; large burn-content parity is not selected by `a3` | frozen `a1`/`a2` compatibility     | partial |
| Continent kit              | six seam-safe component roles plus dual-purpose `duo_mesa`; 21 parts per continent                                                                      | six sparse planner sites           | built   |

## Skycraft construction and technology

The shipping Skiff/Skycutter systems remain `built`. The player-built airframe
program is now an integrated prototype. Automated contracts are present, while
representation, device-performance, BDS, and hands-on acceptance gates remain
open; those rows therefore stay `partial`.

| Capability                        | Progression/source                                      | Status  |
| --------------------------------- | ------------------------------------------------------- | ------- |
| Legacy Skiff and Skycutter        | Starter, Ember, and Frostspire path                     | built   |
| Aether Outrigger prototype        | Summon-only visual, seating, and handling test craft    | partial |
| Steampunk Blimp prototype         | Summon-only art, animation, and four-seat handling test | partial |
| Bounded owned dock berth          | Starter Dockmaster/Ship Core                            | partial |
| Helm-centered connected wood scan | Apprentice Raft certification                           | partial |
| Canonical block blueprint         | Dock validation and persistence                         | partial |
| Mass, lift, thrust, and control   | Apprentice engineering rules                            | partial |
| Downward/aft engine orientation   | Starter and Ember propulsion                            | partial |
| Dockmaster reference blueprints   | Eight gated plans and exact construction orders         | partial |
| Player-saved personal blueprints  | Owner library, revision checks, exact materialization   | partial |
| Ember custom cutter               | Aether Crystal, iron, and redstone                      | partial |
| Balloonwright/dirigible branch    | Sunspire gold/copper and Verdant renewable fabric/wood  | partial |
| Frostwright compact-lift branch   | Frostspire Froststeel and diamond                       | partial |
| Expedition certification          | Glacier/Ashfall Relic Shards                            | partial |
| Masterwork skycraft               | Aether Sanctum Aether Core                              | partial |

Reference designs, provisional certification caps, component families, and
validation gates are defined in
[`SKYCRAFT_TECHNOLOGY_ROADMAP.md`](SKYCRAFT_TECHNOLOGY_ROADMAP.md).

## Items

| Identifier                                                           | Purpose                            | Guaranteed | Status  |
| -------------------------------------------------------------------- | ---------------------------------- | ---------- | ------- |
| `ship_core`, `canvas_bundle`, `thruster_module`                      | Starter skiff                      | yes        | built   |
| `aether_crystal`                                                     | Skycutter unlock                   | yes        | built   |
| `reinforced_hull`, `aether_engine`, `cargo_hold`, `navigator_module` | Skycutter base loadout             | yes        | built   |
| `repair_kit`                                                         | Repair and reconstruction          | yes        | built   |
| `froststeel_ingot`                                                   | Advanced module input              | yes        | built   |
| `armored_hull`, `frostfire_engine`, `expanded_cargo_hold`            | Refit modules                      | yes        | built   |
| `aether_cannon`, `cannon_control`, `aether_charge`                   | Offense utility                    | yes        | built   |
| `shield_projector`, `raider_core`                                    | Defense utility                    | yes        | built   |
| `gold_ingot` (vanilla), `copper_ingot` (vanilla)                     | Desert metal tier                  | yes        | built   |
| `relic_shard`                                                        | Tier-3 unlock currency, 2 required | yes        | built   |
| `aether_core`                                                        | Endgame ship/objective item        | yes        | built   |
| `skyblade`, `frostbrand`, `emberfang`, `aetherpiercer`               | Curated named weapons              | no         | planned |

## Loot tables

`behavior_packs/sk_bp/loot_tables/` is currently empty; guaranteed loot is
script-placed. Ordinary container and mob drops move to JSON loot tables.
Guaranteed progression items stay script-placed and idempotent.

| Table                                                                | Use              | Status  |
| -------------------------------------------------------------------- | ---------------- | ------- |
| `entities/hedgehog`, `goblin`, `yeti`, `demon`, `giant`              | Mob drops        | planned |
| `chests/hut_tier1`, `chests/watchtower_tier2`, `chests/shrine_tier3` | Structure chests | planned |

Multiplayer policy: structure chests are shared and one-time. Guaranteed
progression items are placed once per island content version and are not
refilled per player.

## Progression ladders

### Current implemented ladder

Closure test asserts every `Guaranteed = yes` item is reachable from a fresh
world holding nothing.

| Tier           | Source                                            | Unlocks                                    |
| -------------- | ------------------------------------------------- | ------------------------------------------ |
| Wood           | starter_island's two oak trees (8 logs)           | starter tools, canvas bundles, dock repair |
| Stone          | starter island's exposed 5-block boulder and core | stone pickaxe, basic ship parts            |
| Coal           | starter_island's 8 exposed coal ore               | smelting fuel, Ship Core, Thruster Module  |
| Iron           | starter_island's 12 exposed iron ore              | Ship Core, Thruster Module, skiff          |
| Gold/copper    | sunspire_reach                                    | stronger weapons and Balloonwright systems |
| Aether crystal | ember_outpost                                     | Skycutter                                  |
| Froststeel     | frostspire                                        | refit modules and compact-lift engineering |
| Diamond        | glacier_vault, ashfall_crater                     | final tools, relic access                  |
| Relic shard ×2 | glacier_vault, ashfall_crater                     | aether_sanctum access                      |
| Aether core    | aether_sanctum boss                               | completion objective                       |

### Custom-skycraft capability mapping

The sources and prototype rules are executable. Certification caps and proxy
acceptance remain provisional until the roadmap's BDS/device gates pass.

| Travel tier | Custom certification | Guaranteed prerequisite                     | Required reach                        |
| ----------: | -------------------- | ------------------------------------------- | ------------------------------------- |
|           1 | Apprentice Raft      | Starter wood/coal/iron                      | Ember, Sunspire, Verdant              |
|           2 | Ember Skiff          | Ember Aether Crystal/iron/redstone          | Frostspire                            |
|           3 | Specialist Airframe  | Balloonwright or Frostwright specialization | Glacier Vault and Ashfall Crater      |
|           3 | Expedition Skycraft  | Two Relic Shards                            | Aether Sanctum plus expanded capacity |
|           3 | Masterwork Skycraft  | Aether Core                                 | Post-completion specialization        |

## Localization

Every built custom entity and item above has an `en_US.lang` entry in
`resource_packs/sk_rp/texts/en_US.lang`. A host-side test asserts that no
shipped custom entity or item is missing a display name. Planned identifiers
are not added to executable registries or localization until their assets ship.
