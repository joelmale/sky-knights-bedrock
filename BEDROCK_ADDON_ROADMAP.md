# Sky Knights — Minecraft Bedrock Add-On Plan and Roadmap

> Status: implementation in progress; `0.2.0` Dockyard Refit/Airship Combat,
> the Phase 3 deterministic-realm foundation, the `0.3.0` bootstrap-recovery
> implementation, and the `0.3.1` starter-resource/integrity corrective slice
> are built; hands-on acceptance pending
> Last updated: 2026-07-26
> Working title: **Sky Knights: Bedrock**
> Namespace: `skyknights`
> Recommended implementation: Bedrock Behavior Pack + Resource Pack + TypeScript, optionally bundled with a world template

Current repository capabilities and remaining gates are tracked in
[`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md). Version history is in
[`CHANGELOG.md`](CHANGELOG.md), and completed validation evidence is in
[`docs/VALIDATION_LOG.md`](docs/VALIDATION_LOG.md). Those files are
authoritative for implementation status; this roadmap remains the product
target.

### Implementation checkpoint — 2026-07-26

- Phases 0–1 infrastructure is substantially implemented.
- The Phase 2 starter-island, skiff, expedition, recovery, and persistence loop
  has been built and exercised.
- Phase 3 has a schema-5 world profile and deterministic layout registry, three
  pinned gameplay-ready islands, and five packaged seeded structures. The five
  new islands remain intentionally structure-only until their content and
  progression ship.
- Phase 4 has guaranteed Crystal/Froststeel progression, the Dockmaster,
  tutorial, island guards, and the Ashwing Raider; the full content roster
  remains.
- Phase 5 now has two entity ship frames, four atomic module slots, ownership,
  seats, cargo, health, repair, recall, reconstruction, advanced variants,
  aimed cannon combat, and a shield choice.
- Validation now includes a guarded opt-in BDS `1.26.34.3` harness. It proves
  stable/GameTest pack load and one exact component GameTest; broader
  SimulatedPlayer and real-client coverage remain.
- The next gate is the focused `0.3.1` Phase 3 bootstrap-recovery and
  starter-resource Minecraft
  test plan, followed by
  multiplayer, controller/touch, and clean-client packaging checks.

## 1. Purpose

Build a Minecraft Bedrock add-on that preserves the mechanics and intent of the existing Sky Knights/Aether-Craft Unity project while feeling native to Minecraft.

This is not intended to be a line-by-line port. Minecraft already supplies strong block placement, inventory, crafting, fluids, combat, multiplayer, and save systems. The add-on should reuse those systems where they serve the same purpose and spend custom code on the parts that give Sky Knights its identity:

- isolated, biome-specific floating islands;
- exploration driven by a mine → craft → build → fly → loot loop;
- airships that are progression, transportation, and a shared multiplayer space;
- enemies, structures, resources, and rewards that make each island worth visiting;
- a warm, adventurous “Portal Knights × Minecraft” tone;
- deterministic content and progression that cannot soft-lock.

This plan is grounded in the original Unity repository's
`.ai/docs/Project_Roadmap.md`, `.ai/docs/GlobalArchitecture.md`, and the
registries and tests under `Sky Knights/Assets/_Project/`.

The Unity project currently contains 4 biomes, 5 fluids, 9 creatures, 4 NPCs, 3 structures, 20 recipes, a wood-to-diamond tool ladder, combat and loot, and 4 prebuilt airships. Those are the design reference, not the minimum launch scope.

## 2. Product north star

### Player fantasy

“I am a knight-engineer surviving among dangerous floating islands. I gather materials, improve my equipment, build an airship, and cross the void with friends to discover ruins, creatures, and rare resources.”

### Design pillars

1. **Every trip has a purpose.** An island should offer a resource, challenge, structure, NPC, or secret that is not available at home.
2. **Progression expands reach.** Better tools unlock materials; materials unlock stronger equipment and better ships; better ships reach harder islands.
3. **The airship is earned.** Flight should follow a short survival-and-crafting loop, not be a free creative-mode convenience.
4. **The void matters.** Travel and falling create tension, but recovery rules prevent permanent soft-locks.
5. **Minecraft remains Minecraft.** Mining, block placement, inventory, recipes, water, lava, and multiplayer should use vanilla behavior unless a Sky Knights rule truly needs to differ.
6. **Systems are data-driven.** Island, creature, loot, recipe, ship, and progression data should live in registries/configuration rather than scattered conditionals.

### Core player loop

```text
Arrive at a safe island
  → harvest trees and surface materials
  → craft tools and ship components
  → explore a local ruin and fight or evade enemies
  → assemble or upgrade an airship at a dock
  → fly to a more dangerous biome island
  → obtain gated ore, loot, and knowledge
  → return, craft the next tier, and expand farther
```

### Experience targets

- In the first 10 minutes, a new player understands the void, gathers wood, crafts a useful tool, and meets the dockmaster.
- In the first 30–45 minutes, a player can launch the starter skiff and make a meaningful inter-island trip.
- Each biome is recognizable from silhouette, block palette, weather/particles, resources, structures, and creature mix.
- Two to four players can share a world without duplicating progression, stealing ship control accidentally, or corrupting generated islands.
- Falling or dying is costly enough to matter but never destroys the only route back into the progression loop.

## 3. Scope

### Vertical slice

The first playable slice should prove the complete loop with deliberately limited content:

- one Verdant home island;
- one hostile destination island, initially Volcanic or Tundra;
- trees, stone, coal, one gated metal, and one rare “aether” resource;
- wood and stone tools using vanilla item behavior;
- one small ruin with a loot chest;
- one passive creature and two hostile creatures;
- a dockmaster NPC with a short tutorial dialogue;
- one craftable, flyable, one- or two-seat skiff;
- fall rescue, death/respawn, persistence, and two-player testing.

The slice is successful when a fresh survival player can complete:

```text
tree → planks → tools → ore → ship parts → skiff → remote ruin → loot → safe return
```

### Version 1.0

- a deterministic sky realm with Verdant, Desert, Tundra, and Volcanic island families;
- a safe starter island plus at least one meaningful destination per biome;
- wood → stone → gold → diamond tool progression;
- clustered, biome-flavored ore distribution;
- huts, ruins, and watchtowers with tiered loot;
- renewable wood and ordinary Minecraft building;
- at least one passive creature, four standard enemies, and one boss-class enemy;
- four named NPC roles with dialogue and lightweight guidance;
- two ship frames or four ship visual variants, with upgrades and multiplayer seats;
- ship health, docking, recovery, and optional cargo;
- named Sky Knights weapons as a small curated set, not all 51 Unity sword variants;
- persistent world generation, player progression, and ship state;
- packaging as an importable add-on and, if required by the dimension decision, a world template.

### Explicit non-goals for 1.0

- Moving an arbitrary player-built collection of blocks as a rigid airship.
- Exact reproduction of Unity’s Newtonian block-by-block ship physics.
- Exact reproduction of Unity terrain hashes or island geometry.
- A replacement for Minecraft’s inventory, hotbar, crafting screen, water, or lava simulation.
- All 55 Unity blocks, 143 items, 196 props, 51 swords, or 5 fluids.
- Honey, slime, and oil fluid simulation.
- Infinite seamless procedural generation.
- Marketplace submission, monetization, or Realms certification.
- A custom pre-game lobby comparable to the Unity diorama.

These exclusions are scope controls, not permanent prohibitions.

## 4. Bedrock product and compatibility decision

Use the Bedrock term **Add-On**, even if the project is informally called a mod.

### Technical baseline

- Behavior Pack for entities, recipes, loot, blocks/items, structures, and server-side script.
- Resource Pack for textures, geometry, animations, sounds, particles, UI strings, and icons.
- TypeScript compiled to JavaScript for the Script API.
- Minimum content format/engine target: **1.21.90**, because `minecraft:input_air_controlled` requires at least that format version.
- Stable Script API dependencies wherever possible.
- Beta API isolated behind a build profile if the custom-dimension route is selected.
- Short deployed pack folder names such as `sk_bp` and `sk_rp` to remain friendly to world-template and console path constraints.
- Windows Bedrock client as the primary development target; controller and touch input remain release gates.

Pin exact module and engine versions when the scaffold is created. Do not leave dependencies on floating `"beta"` versions except in the explicitly experimental build profile.

### Critical dimension choice

As of this plan, scripted custom dimensions are documented as experimental and use a void generator. The project therefore needs two supported strategies:

#### Strategy A — world-template sky realm, recommended for the stable release

- Package a configured void world with the Behavior and Resource Packs enabled.
- Generate or stamp islands into that controlled world.
- Export it as `.mcworld` during development and `.mctemplate` for repeatable new games.
- Keep ordinary add-on packaging for pack-only development.

Benefits:

- stable distribution target;
- complete control of spawn, void, gamerules, and initial chunks;
- lower risk of an engine update breaking dimension registration.

Costs:

- players start from the supplied world/template instead of adding the full experience cleanly to any existing world;
- the world and packs must be versioned and tested together.

#### Strategy B — custom `skyknights:sky_realm`, experimental profile

- Register a void custom dimension during the startup event.
- Generate the starter platform and islands through script/structures.
- Enter through a portal, command, or guided UI.

Benefits:

- cleaner separation from vanilla dimensions;
- closer to the Unity game’s lobby-to-world model;
- can coexist with an existing survival world.

Costs:

- currently requires Beta APIs;
- subject to signature, behavior, and distribution changes;
- needs stronger migration and compatibility testing.

#### Gate

Do not build the main game on Strategy B until Phase 0 proves:

- registration after install, reload, pack upgrade, and world copy;
- multiplayer travel;
- safe spawn and return;
- behavior on supported devices;
- acceptable packaging/distribution for the intended audience.

If any gate fails, use Strategy A without delaying the vertical slice.

## 5. Unity-to-Bedrock translation

| Sky Knights mechanic  | Existing intent                                                            | Bedrock implementation                                                                                             | Fidelity target              |
| --------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| Floating island world | Distinct islands separated by meaningful flight                            | Void world/dimension plus deterministic island layout and `.mcstructure` or scripted generation                    | High                         |
| Four biomes           | Verdant, Desert, Tundra, Volcanic with different resources and silhouettes | Island families with vanilla/custom block palettes, particles, fog where available, features, structures, and mobs | High                         |
| Voxel mining/building | Everything important participates in the block loop                        | Reuse vanilla block breaking, placement, drops, tools, enchantments, and inventory                                 | Native substitution          |
| Tool tiers            | Wood → stone → gold → diamond gates                                        | Prefer vanilla tiers and recipes; add custom tags/components only for Sky Knights ores                             | High                         |
| Ore veins             | Clustered, biome-flavored, depth-gated resources                           | Pre-generated/script-generated clusters inside islands; no uniform speckle                                         | High                         |
| Harvestable trees     | Renewable wood economy with regrowth                                       | Vanilla trees/saplings or custom tree structures with vanilla log drops                                            | Native substitution          |
| Crafting and smelting | Mine → smelt → craft closes progression                                    | JSON recipes and furnaces; custom UI only for ship assembly or special forging                                     | Native substitution          |
| Structures and chests | Exploration sites with tiered, guaranteed loot                             | `.mcstructure` templates, loot tables, structure placement APIs                                                    | High                         |
| Combat                | Readable melee, enemies fight back, reward on kill                         | Bedrock damage, AI goals/components, animations, loot tables, optional item custom components                      | High                         |
| NPC dialogue          | Safe, non-combat townsfolk who guide the player                            | Custom NPC entities plus interaction event and Action/Message forms                                                | Medium-high                  |
| Five fluids           | Water/lava gameplay plus deferred exotic fluids                            | Vanilla water/lava for 1.0; exotic fluids deferred                                                                 | Intent-first                 |
| Airship flight        | Earned flight, helm control, shared ship space                             | Rideable flying entity using `minecraft:input_air_controlled`; entity variants and seat definitions                | High fantasy, medium physics |
| Ship builder          | Assemble components and improve the craft                                  | Dockyard slot/blueprint builder that converts crafted modules into an entity configuration                         | Medium-high                  |
| Four prebuilt ships   | Increasing size/capability                                                 | Skiff, fighter, sailing ship, blimp variants or upgrade tiers                                                      | High                         |
| World presets/lobby   | Choose world style before generation                                       | World-template variants or first-join setup form; defer advanced sliders                                           | Medium                       |
| Determinism           | Same seed/config gives same content                                        | Seeded TypeScript PRNG, stable island IDs, versioned layout registry                                               | High                         |
| Persistence           | World/player/ship state survives safely                                    | World, player, and entity dynamic properties with schema version and migration                                     | High                         |

## 6. Architecture

### Suggested repository layout

Create the port beside the Unity project rather than inside `Assets/`:

```text
BedrockSkyKnights/
├── package.json
├── package-lock.json
├── tsconfig.json
├── .env.example
├── behavior_packs/
│   └── sk_bp/
│       ├── manifest.json
│       ├── entities/
│       ├── items/
│       ├── blocks/
│       ├── recipes/
│       ├── loot_tables/
│       ├── structures/
│       ├── spawn_rules/
│       └── scripts/                 # compiled output
├── resource_packs/
│   └── sk_rp/
│       ├── manifest.json
│       ├── entity/
│       ├── models/entity/
│       ├── animations/
│       ├── animation_controllers/
│       ├── textures/
│       ├── particles/
│       ├── sounds/
│       └── texts/
├── scripts/                         # TypeScript source
│   ├── main.ts
│   ├── bootstrap/
│   ├── content/
│   ├── world/
│   ├── progression/
│   ├── ships/
│   ├── combat/
│   ├── npc/
│   ├── persistence/
│   ├── ui/
│   └── util/
├── tests/                           # host-side unit tests
├── gametests/                       # in-engine integration tests
├── tools/                           # validators and packaging helpers
├── world_template/                  # only if Strategy A is selected
└── docs/
    ├── DECISIONS.md
    ├── CONTENT_MATRIX.md
    └── PLAYTEST.md
```

### Runtime ownership

The server/script runtime is authoritative for:

- island generation state;
- world seed/profile;
- quest/progression flags;
- dockyard assembly transactions;
- ship ownership, pilot arbitration, health, cargo, and recovery;
- one-time loot/structure state when vanilla containers are insufficient;
- fall rescue and safe respawn;
- migrations.

Clients/resource packs own presentation only:

- geometry and textures;
- animation controllers;
- particles and sounds;
- localized strings and icons.

Do not trust a client-side form response without rechecking materials, distance, ownership, and current state on the server.

### Data registries

Keep the Unity project’s append-only/data-driven discipline, adapted to namespaced string identifiers:

```ts
type IslandFamily = {
  id: string;
  paletteId: string;
  size: "small" | "medium" | "large";
  resourceTableId: string;
  structurePoolId: string;
  encounterTableId: string;
  minimumShipTier: number;
};

type ShipFrame = {
  id: string;
  tier: number;
  seatCount: number;
  maxHealth: number;
  cargoSlots: number;
  speedClass: number;
  requiredModules: readonly Ingredient[];
  entityEvent: string;
};

type ProgressionNode = {
  id: string;
  requires: readonly string[];
  grants: readonly string[];
};
```

Rules:

- never rename or reuse a shipped identifier;
- validate all references at startup and in host-side tests;
- separate immutable content identity from balance values;
- store `contentVersion` and `saveSchemaVersion` independently;
- maintain a progression-closure test so every required tier remains obtainable.

### Module boundaries

- `bootstrap`: subscriptions, startup registration, player join, script health check.
- `content`: typed registries and reference validation.
- `world`: seed, layout, island jobs, structures, encounters, fall boundary.
- `progression`: unlock graph, recipes/requirements, player guidance.
- `ships`: dockyard, frame/module state, pilot ownership, recovery.
- `combat`: only the behavior that vanilla entity/item JSON cannot express.
- `npc`: dialogue and interaction routing.
- `persistence`: typed dynamic-property access, versioning, migrations.
- `ui`: forms and action-bar messages; no game-state mutation without service validation.
- `util`: PRNG, hashing, vectors, queues, logging, assertions.

## 7. World generation plan

### First implementation: authored island templates

Use authored `.mcstructure` islands for the vertical slice. This rapidly validates scale, silhouettes, caves, ore access, navigation, structure placement, and ship travel without betting the project on a high-volume script generator.

Each island template should have:

- a stable island ID and local origin;
- a protected spawn/dock zone;
- marked structure anchors;
- marked encounter anchors;
- ore sockets or replaceable stone regions;
- a safe maximum and minimum Y range;
- no required entity embedded in the template unless its lifecycle is understood.

Apply deterministic variation after placement:

- rotate/mirror where supported;
- select one of several surface/structure variants;
- seed ore pockets;
- select encounter and loot tables;
- place vegetation and particles;
- record the completed generation stages.

### Later implementation: hybrid procedural islands

After the vertical slice, add generated island bodies in bounded cells:

1. Compute island centers from a seeded layout function.
2. Reserve non-overlapping bounds and travel lanes.
3. Generate a coarse body/silhouette.
4. Apply biome palette and strata.
5. Add clustered ore veins.
6. Place surface features.
7. Stamp structures.
8. Spawn encounters only after terrain is complete.
9. Mark the island ready and persist its generation version.

Keep authored hero structures and docks even if terrain becomes procedural.

### Generation job queue

Never place or scan an entire large island in one tick.

- Represent generation as resumable jobs.
- Process a measured block/structure budget per tick.
- Yield immediately when a chunk is unavailable or the time budget is exhausted.
- Persist coarse stages, not every loop cursor unless profiling proves it necessary.
- Make every stage idempotent so a reload can safely retry it.
- Generate ahead of player travel, beginning when a destination is revealed or selected.
- Keep a safe holding platform until the destination reports `ready`.

Performance budgets must be established by the Phase 0 spike on the weakest supported device. Avoid inventing a fixed “blocks per tick” number before measuring.

### Determinism contract

For a fixed `(worldSeed, contentVersion, islandId)`:

- island center, family, variant, resources, structures, and encounter seeds are stable;
- iteration order is explicitly sorted where results could otherwise vary;
- random streams are separated by purpose, so changing loot does not move an island;
- a content migration never partially regenerates a player-modified island;
- generation records distinguish authored terrain from player edits.

## 8. Gameplay implementation

### Progression and economy

Prefer vanilla logs, planks, cobblestone, coal, iron, gold, diamond, crafting tables, furnaces, tools, durability, and containers. Add Sky Knights-specific materials only where they create identity or control progression.

Recommended initial special items:

- `skyknights:aether_shard` — rare travel/upgrade resource;
- `skyknights:ship_core` — crafted once per ship;
- `skyknights:canvas_bundle` — hull/lift module ingredient;
- `skyknights:thruster_module` — propulsion upgrade;
- `skyknights:helm` — dockyard activation item;
- optional biome relics used for tier unlocks.

Recommended ladder:

| Tier       | Primary source              | Unlocks                               | Shortcut                              |
| ---------- | --------------------------- | ------------------------------------- | ------------------------------------- |
| Wood       | home-island trees           | starter tools, dock repairs           | hut loot                              |
| Stone      | home-island stone/ruin      | furnace access, basic ship parts      | hostile drop                          |
| Gold/metal | Desert or Volcanic ore      | faster ship frame, stronger weapons   | watchtower loot                       |
| Diamond    | deep Tundra/Volcanic pocket | final tools, obsidian/relic access    | boss-class loot                       |
| Aether     | relic sites/bosses          | advanced ship and endgame destination | none guaranteed outside intended path |

Add a host-side reachability test that starts with only the intended spawn resources, repeatedly applies mining/loot/recipe/unlock rules, and asserts that every required 1.0 item becomes reachable.

### Blocks and fluids

- Use vanilla blocks for terrain whenever their look and behavior fit.
- Introduce custom blocks sparingly: aether ore/crystal, dock core, shipyard marker, and a small number of decorative identity blocks.
- Use vanilla water and lava.
- Preserve biome flavor through palettes, particles, structures, entities, and sound rather than cloning every Unity block.
- Never make ordinary player building depend on script-maintained block databases.

### Structures and loot

Initial structure set:

- starter dock/workshop;
- small ruin;
- wood hut;
- watchtower;
- one biome shrine or boss arena.

Use `.mcstructure` templates for geometry and JSON loot tables for ordinary containers. Script only:

- guaranteed quest/key items;
- one-time world unlocks;
- generation markers;
- complex ownership or party reward rules.

Loot rules:

- every required progression item has a guaranteed path;
- rare equipment is a bonus, not the only route forward;
- multiplayer containers must have an explicit shared-vs-per-player rule;
- dropped items should never be intentionally scattered toward a void edge.

### Creatures and combat

Suggested 1.0 roster mapped from the Unity project:

- Hedgehog — passive ambient creature.
- Goblin — early melee enemy.
- Skeleton or Zombie — common ruin enemy.
- Yeti — Tundra heavy enemy.
- Demon — Volcanic elite.
- Giant — boss-class enemy.

Use Bedrock entity components for health, navigation, targeting, attacks, rideability, drops, and animations. Add script only when a behavior cannot be described reliably in entity JSON.

Combat rules to preserve:

- enemies must have readable wind-up and hit feedback;
- dangerous enemies pay better;
- passive creatures do not carry half-configured hostile behavior;
- no ordinary enemy should one-shot a full-health player;
- terrain and line-of-sight should provide real escape options;
- enemy drops supplement crafting rather than replace it.

### NPCs and guidance

Initial roles:

- Dockmaster — introduces ship construction and travel.
- Smith — explains tool/weapon progression.
- Cartographer — reveals or describes destinations.
- Lorekeeper — provides flavor and late-game direction.

Use interaction events plus message/action forms. Dialogue must remain usable with keyboard, controller, and touch. NPCs are non-combat entities and should not share enemy health/loot families.

### Airships

#### 1.0 representation

Represent each active airship as a custom rideable flying entity:

- `minecraft:rideable` for one or more seats;
- `minecraft:input_air_controlled` for three-dimensional pilot input;
- movement/flying components tuned per frame;
- entity properties/component groups for frame and module variants;
- geometry/animation variants for skiff, fighter, sailing ship, and blimp;
- dynamic properties for owner, tier, health, cargo, dock, and recovery state.

The pilot seat controls the entity. Passenger seats do not. A server-side pilot lock prevents two players from claiming the helm in the same tick.

#### Dockyard builder

Preserve the “buildable airship” intent with a constrained slot-based builder:

1. The player places or interacts with a dock core.
2. The dock UI shows frame and module slots.
3. The server validates and consumes hull, helm, lift, and thruster ingredients atomically.
4. The completed configuration spawns or upgrades the rideable ship entity.
5. Changing modules updates entity properties/component groups and presentation.
6. Dismantling at a dock returns a defined fraction of materials.

This keeps building, massing resources, visual customization, and upgrade decisions while avoiding the unsupported promise that any arbitrary block assembly can move as one physics body.

Possible later modules:

- cargo hold;
- reinforced hull;
- speed thruster;
- lift balloon;
- cannon;
- shield generator;
- compass/radar.

#### Flight and recovery rules

- Flight begins and ends at a helm/dock interaction, not an obscure command.
- Jump/ascend and sneak/descend behavior must be tested on keyboard, controller, and touch.
- Leaving a ship in mid-air must have a deliberate rule: remain hovering, slowly descend, or return to the last dock.
- An unoccupied ship must not load or tick forever at arbitrary distance.
- Destroyed or lost ships can be recovered at their bound dock for a cost.
- Falling below the world safety threshold returns the player to the last safe island/dock and applies a clear penalty.
- Cargo loss behavior must be decided before cargo ships are enabled.

## 9. Persistence and migration

### World properties

- `skyknights:save_schema`
- `skyknights:content_version`
- `skyknights:world_seed`
- `skyknights:world_profile`
- `skyknights:generation_index`
- compact generation state keyed by stable island IDs

### Player properties

- onboarding/tutorial stage;
- discovered islands;
- last safe dock;
- personal unlocks, if any;
- party/ship membership if required.

### Ship properties

- stable ship ID;
- owner/party ID;
- frame and modules;
- health and cargo policy;
- home dock;
- recovery state.

### Rules

- Wrap all dynamic-property access in typed repository functions.
- Include a schema version from the first playable build.
- Back up or copy the test world before every migration test.
- Migrations are monotonic, resumable, and logged.
- Never overwrite a player-modified island merely because its content version changed.
- Test save/load after death, while riding, while generating, and during a pack version upgrade.

## 10. Testing and quality gates

### Host-side tests

Run outside Minecraft on every change:

- deterministic PRNG and island layout snapshots;
- registry reference validation;
- progression reachability;
- recipe and loot invariants;
- ship module validation and atomic material costs;
- save serialization/migration;
- fall/recovery state transitions;
- multiplayer pilot arbitration.

### GameTests/in-engine tests

Automate where practical:

- manifests and script entry point load (first BDS smoke implemented);
- starter island/dock placement;
- island generation resumes after reload;
- loot structure contains required rewards;
- ship entity spawns with correct components/seats;
- mount, pilot, dismount, death, and recovery;
- two players cannot both become pilot;
- NPC interaction opens and advances dialogue;
- a fresh player can complete the critical progression chain.

Keep BDS/GameTest opt-in and version-gated. Use `SimulatedPlayer` only for
bounded server-side behavior; client UI, input feel, rendering, and real
multiplayer remain manual gates.

### Manual playtest matrix

At each milestone:

- fresh world and upgraded world;
- single-player and two-player host/client;
- keyboard/mouse and controller;
- touch before 1.0;
- normal render distance and deliberately low render distance;
- leave/rejoin while generation is active;
- death in combat, death in lava, fall into void, death while aboard;
- ship abandoned, ship unloaded, owner offline, passenger left aboard;
- full inventory during crafting and loot collection.

### Required commands/scripts

The scaffold should expose stable commands such as:

```text
npm run build
npm run lint
npm test
npm run local-deploy
npm run local-deploy -- --watch
npm run mcaddon
```

Add JSON/content validation to `npm test` rather than relying on Minecraft’s content log as the first line of defense.

### Definition of done for a feature

- Behavior is expressed in data where Bedrock supports it.
- Server-side mutation is authoritative and multiplayer-safe.
- Identifiers are namespaced and registered.
- Persistence impact and migration needs are documented.
- Host-side tests pass.
- Relevant GameTests pass.
- Keyboard/controller behavior is manually checked.
- Content log contains no new errors.
- The feature has an observable in-game acceptance scenario.
- Roadmap/content matrix is updated.

## 11. Phased roadmap

Effort is expressed in focused developer-days and excludes creation of a large original art library. For a solo learning project, calendar time will be longer.

### Phase 0 — capability and packaging spikes

Estimated effort: 3–5 days.

Deliver four disposable proofs:

1. **Dimension proof**
   - Build both a world-template void world and an experimental custom dimension.
   - Enter, leave, reload, copy, upgrade, and join with a second player.
2. **Flight proof**
   - Create a gray-box rideable flying entity with pilot and passenger seats.
   - Test three-dimensional input on keyboard and controller.
3. **Generation proof**
   - Place one medium island structure and one scripted block-volume island through a resumable queue.
   - Measure tick stability and load/reload behavior.
4. **Persistence proof**
   - Save a seed, generated-island marker, player discovery, and ship configuration.
   - Run a dummy schema migration.

Exit criteria:

- choose Strategy A or B and record the decision;
- choose authored-template, procedural, or hybrid generation for the vertical slice;
- confirm the minimum supported game version and exact module versions;
- confirm the ship control model is fun enough to continue;
- record measured performance on the weakest available target device.

### Phase 1 — production scaffold

Estimated effort: 3–5 days.

Deliver:

- `BedrockSkyKnights/` project structure;
- Behavior and Resource Pack manifests with fixed UUIDs;
- TypeScript build, watch deploy, lint, tests, and package commands;
- stable/beta build profiles if Strategy B remains alive;
- `skyknights` registries and startup validation;
- structured logging and a `/skyknights:debug` or equivalent development command;
- one automated GameTest;
- CI or a repeatable local verification script.

Exit criteria:

- a clean clone installs, builds, deploys, and loads;
- the content log is clean;
- a packaged artifact imports into a fresh client;
- no gameplay module depends directly on raw dynamic-property strings.

### Phase 2 — complete gray-box vertical loop

Estimated effort: 7–10 days.

Deliver:

- safe home island and dock;
- wood/stone gathering and initial recipes;
- dockmaster dialogue;
- one remote hostile island;
- one ruin and loot table;
- two enemies and basic combat rewards;
- starter skiff recipe, dock assembly, pilot/passenger flight;
- fall rescue and last-safe-dock respawn;
- save/load and two-player validation.

Exit criteria:

- a fresh survival player completes the full vertical-slice loop without commands;
- no required item is random-only;
- both players can travel together;
- ship loss cannot permanently soft-lock progression;
- reload at every major loop step preserves state.

Milestone: **Playable prototype**.

### Phase 3 — deterministic sky realm

Estimated effort: 8–12 days.

Deliver:

- seed/profile selection;
- stable island layout registry;
- Verdant, Desert, Tundra, and Volcanic island families;
- hybrid template/procedural generation queue;
- biome palettes, vegetation, ore clusters, encounter anchors, and structure pools;
- destination discovery and pre-generation;
- generation persistence and upgrade-safe island versioning.

Exit criteria:

- same seed/content version produces the same layout and content selections;
- all four biome families are visually and mechanically distinct;
- travel lanes and spawn zones remain clear;
- generation does not create unsafe player spawns;
- a reload during each generation stage completes correctly.

### Phase 4 — progression, combat, structures, and NPCs

Estimated effort: 8–12 days.

Deliver:

- closed wood → stone → gold → diamond ladder;
- custom aether resource and ship upgrade sinks;
- hut, ruin, watchtower, and shrine/boss structure;
- at least five enemy/passive entity roles;
- tiered loot and guaranteed progression items;
- Dockmaster, Smith, Cartographer, and Lorekeeper dialogue;
- a small named-weapon set;
- host-side progression-closure tests.

Exit criteria:

- every 1.0 progression node is reachable from a fresh world;
- harder biomes produce clearly better rewards;
- no ordinary enemy one-shots a full-health player;
- multiplayer loot policy is consistent and documented;
- content registry validation rejects missing references.

### Phase 5 — ship builder depth

Estimated effort: 8–12 days.

Deliver:

- at least two ship frames and visual variants up to the four reference archetypes;
- module slots, atomic assembly, upgrades, and dismantling;
- multiple seats and pilot arbitration;
- health, damage feedback, docking, abandonment, and recovery;
- cargo only if its loss/ownership rules are complete;
- optional first cannon or shield prototype.

Exit criteria:

- ship tiers create meaningful capability choices;
- every ship can be recovered without admin commands;
- pilot/passenger state survives reconnects safely;
- ships do not accumulate as permanently ticking entities;
- touch control is evaluated before freezing the flight design.

### Phase 6 — content-complete 1.0

Estimated effort: 10–15 days.

Deliver:

- final island counts and travel progression;
- completed block/item/entity/structure art;
- sounds, particles, names, lore, and tutorial text;
- balance pass for recipes, travel time, combat, loot, and recovery costs;
- late-game destination and completion objective;
- accessibility/readability pass;
- world-template icon and localized `en_US.lang`;
- clean importable release artifacts.

Exit criteria:

- a new player can reach the completion objective without developer help;
- two-to-four-player session completes the critical path;
- all P0/P1 defects are closed;
- no licensed Unity asset is redistributed without confirmed rights for the Bedrock package.

Milestone: **Feature complete**.

### Phase 7 — hardening and release candidate

Estimated effort: 8–12 days.

Deliver:

- migration tests from every public test build;
- long-session performance and entity cleanup;
- low-end/device/input testing;
- pack conflict and missing-resource behavior;
- backup/recovery documentation;
- `.mcaddon` and, if used, `.mctemplate` release artifacts;
- installation, known-issues, and playtest instructions.

Exit criteria:

- release checklist passes twice from clean installs;
- no save corruption across the supported upgrade path;
- no sustained tick degradation in the target multiplayer session;
- artifact versions, manifests, and documentation agree.

Milestone: **1.0 release candidate**.

### Estimated total

- Vertical slice: approximately **13–20 focused developer-days** after the capability choices are made.
- Version 1.0: approximately **55–83 focused developer-days**.
- Plan additional time for original models, textures, animation, sound, device testing, and Bedrock API changes.

## 12. Prioritized backlog

### P0 — proves the project

- Dimension/world-template decision.
- Flyable rideable entity.
- Safe void spawn and fall recovery.
- Deterministic island placement.
- Complete gather/craft/fly/loot loop.
- Save schema and migration seam.
- Two-player pilot/passenger test.

### P1 — defines 1.0

- Four biome families.
- Closed tool/resource ladder.
- Structures and tiered loot.
- Enemy roster and boss-class encounter.
- Dockyard ship builder and upgrades.
- NPC guidance.
- Packaging and update tests.

### P2 — strong follow-up

- Cargo holds.
- Cannons and ship combat.
- Shield generator.
- More ship frames/skins.
- More named weapons.
- Quests, trading, and branching dialogue.
- Weather and stronger biome atmosphere.
- More world profiles.

### P3 — experimental

- Arbitrary construction-pad scanning.
- Larger modular ship visual combinations.
- Exotic fluids.
- Infinite/streamed island generation.
- Realms/public-server support.
- Marketplace-quality packaging.

## 13. Risk register

| Risk                                            | Likelihood/impact | Mitigation                                                                       | Trigger                                                    |
| ----------------------------------------------- | ----------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Custom dimensions remain experimental or change | High/high         | Phase 0 gate; stable world-template fallback; isolate beta imports               | Registration or upgrade test fails                         |
| Arbitrary block ships are not viable            | High/high         | Commit to entity ships and slot-based dockyard building for 1.0                  | Gray-box ship cannot represent a freeform hull             |
| Runtime island generation causes tick stalls    | Medium/high       | Templates first; resumable measured queue; pre-generate destinations             | Watchdog/content log warnings or visible tick loss         |
| Experimental APIs block intended distribution   | Medium/high       | Stable release profile; document required experiments; package template          | Target device cannot enable required API                   |
| Asset rights do not permit a Bedrock port       | Medium/high       | Treat Unity assets as references until license audit; make original replacements | First external playtest/package share                      |
| Updates break manifests or script APIs          | High/medium       | Pin versions; test Preview separately; schema/version matrix                     | Engine update or module bump                               |
| Touch/controller flight feels poor              | Medium/high       | Test in Phase 0 and Phase 5; use native air-controlled input                     | Cannot ascend/descend reliably                             |
| Multiplayer duplicates loot or ship ownership   | Medium/high       | Server-authoritative atomic services and explicit loot rules                     | Concurrent interaction test fails                          |
| Lost ships or void deaths soft-lock players     | Medium/high       | Bound docks, recovery cost, last-safe-dock state                                 | Player has no reachable ship/material path                 |
| Scope expands to the full Unity content count   | High/medium       | Enforce vertical-slice and 1.0 matrices; move variants to P2                     | Feature does not support a design pillar or exit criterion |

## 14. Initial decisions to record

Create these as short ADR-style entries in `docs/DECISIONS.md`:

1. Add-On, not native-code mod.
2. World-template versus experimental custom dimension.
3. Minimum supported Bedrock version and pinned Script API modules.
4. Entity-based airships with dockyard module construction.
5. Authored, procedural, or hybrid islands.
6. Vanilla-first block/tool/fluid policy.
7. Shared or per-player loot in multiplayer.
8. Ship ownership and recovery policy.
9. World/player/ship dynamic-property schema.
10. Supported devices and multiplayer host model.

## 15. First ten implementation tickets

1. Scaffold the TypeScript Behavior/Resource Pack project from the official starter.
2. Add fixed manifests, UUIDs, namespace rules, build profiles, and clean-load test.
3. Build the Strategy A void world-template proof.
4. Build the Strategy B custom-dimension proof and record compatibility results.
5. Build a gray-box `skyknights:skiff` with pilot and passenger seats.
6. Add typed dynamic-property repositories and a dummy v1 → v2 migration.
7. Place a starter island `.mcstructure`, dock marker, and safe spawn.
8. Add fall rescue and last-safe-dock tracking.
9. Add the home-island wood/stone recipes and Dockmaster interaction.
10. Add a remote ruin island and prove the complete two-player trip-and-return loop.

Do not start broad content production before tickets 1–10 pass their exit scenarios.

## 16. Release checklist

- [ ] Exact engine and module versions are pinned and documented.
- [ ] Behavior and Resource Pack manifests use stable UUIDs and matching dependencies.
- [ ] Stable world-template or experimental-dimension requirements are explicit.
- [ ] Fresh install, fresh world, and upgraded world all load without content errors.
- [ ] Progression closure test passes.
- [ ] GameTests and host-side tests pass.
- [ ] Single-player and two-to-four-player critical paths pass.
- [ ] Keyboard, controller, and touch critical actions pass.
- [ ] Fall, death, ship loss, disconnect, and recovery paths pass.
- [ ] No required progression item depends only on random loot.
- [ ] Generator resumes safely after reload.
- [ ] Dynamic-property migration is tested from every supported public build.
- [ ] Long-session entity and tick performance are acceptable.
- [ ] Licenses permit every redistributed texture, model, sound, and animation.
- [ ] `.mcaddon` and/or `.mctemplate` imports from a clean client.
- [ ] Version, changelog, installation steps, and known issues agree.

## 17. Official Bedrock references

These links were checked while preparing this plan on 2026-07-25:

- [TypeScript scripting starter](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/next-steps?view=minecraft-bedrock-stable)
- [Custom Dimension API tutorial — currently experimental](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/custom-dimension-api-tutorial?view=minecraft-bedrock-stable)
- [Official custom-dimensions sample](https://learn.microsoft.com/en-us/samples/microsoft/minecraft-samples/custom-dimensions-sample/)
- [`minecraft:input_air_controlled`](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_input_air_controlled?view=minecraft-bedrock-stable)
- [Entity components guide, including rideable entities](https://learn.microsoft.com/en-us/minecraft/creator/documents/entitycomponentsguide?view=minecraft-bedrock-stable)
- [World-generation overview](https://learn.microsoft.com/en-us/minecraft/creator/documents/world-generation?view=minecraft-bedrock-stable)
- [Structure Manager Script API](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/structuremanager?view=minecraft-bedrock-stable)
- [GameTest introduction](https://learn.microsoft.com/en-us/minecraft/creator/documents/gametestgettingstarted?view=minecraft-bedrock-stable)
- [World template creation](https://learn.microsoft.com/en-us/minecraft/creator/documents/createaworldtemplate?view=minecraft-bedrock-stable)
- [Bedrock package file extensions](https://learn.microsoft.com/en-us/minecraft/creator/documents/minecraftfileextensions?view=minecraft-bedrock-stable)
- [Pack manifest reference](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/addonsreference/packmanifest?view=minecraft-bedrock-stable)

## 18. Roadmap maintenance

Update this file when:

- a Phase 0 decision changes the architecture;
- a milestone begins or reaches its exit criteria;
- a Bedrock engine/API update changes the minimum version;
- a mechanic moves between 1.0 and deferred scope;
- a playtest reveals a new soft-lock, multiplayer, or performance risk.

Keep detailed implementation decisions and session notes out of this roadmap. Record them in `BedrockSkyKnights/docs/DECISIONS.md` and focused development logs once the add-on project exists.
