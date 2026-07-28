# Changelog

This file records shipped playtest builds and notable repository milestones.
Validation evidence and pending hands-on gates are maintained in
[`docs/VALIDATION_LOG.md`](docs/VALIDATION_LOG.md).

## [0.3.7] — 2026-07-28

### Fixed

- **D-1**: the Dockmaster no longer falls forever when its dock deck is
  destroyed. It has gravity and a damage sensor that refuses every source
  including the void, so a broken deck dropped it into the void while the
  200-tick sweep teleported it back, indefinitely, every ten seconds. The dock
  sweep is now deck-aware and cannot produce that combination for any input.

### Added

- Destroying the dock deck beneath the Dockmaster now has consequences, gated
  so it cannot trap a new player:
  - before the player's first ship, the deck plank is rebuilt, because the
    Dockmaster is the only route to that ship;
  - after the first ship, the destruction is treated as deliberate: Elian
    rises from the wreckage and turns hostile, flying, damaging, and targeting
    players within 48 blocks.
- The transformation swaps Bedrock component groups on the existing entity
  rather than spawning a new one, so it needs no new model, texture, or
  resource-pack change. A steward Dockmaster is also re-stewarded on sight, so
  an entity spawned before the component groups existed heals itself.
- Dockmaster mood persists in its own world dynamic property rather than the
  world state document, so this slice adds no schema version.

### Changed

- Bumped the add-on, stable packs, world template, and GameTest dependency
  profile to `0.3.7`.

### Validation

- `npm run verify` passed with 238 tests across 41 files.
- `npm audit --audit-level=high` reported zero vulnerabilities.
- The dock-deck decision table is exhaustively unit-tested, including a
  regression asserting that no combination of inputs ever asks to station a
  Dockmaster whose deck is gone.
- The in-game transformation, flight, and combat behaviour remain a Minecraft
  hands-on acceptance check.

## [0.3.6] — 2026-07-27

### Fixed

- Raised every starter-island resource to at least 2.5x what the command-free
  first-skiff route actually spends. The `0.3.5` playtest reached the Ship Core
  recipe with two iron because ten of the island's twelve iron blocks sat on
  the tapered underside, which cannot be mined before the skiff that iron pays
  for. Iron is now 18 blocks, coal 8, exposed boulder stone 10, and standing
  oak 16.
- Moved all starter ore into the band reachable by digging down from the
  walkable surface. Six ore columns now break the grass with open sky above
  them — four iron and two coal — each continuing straight down, plus shallow
  pockets three to four blocks under the clearing. No starter ore is placed on
  the island's underside or sheer side faces.
- Added a third and fourth oak tree so the wood margin is carried in standing
  trees rather than in a buffer the player has to guess at.

### Added

- Derived the starter resource minimums from an explicit route-requirement
  table and a single `2.5` margin constant, so a recipe retune cannot silently
  erode the buffer. The generator refuses to build an island that places ore
  below the reachable band, floats ore outside the body, or drops below four
  visible iron and two visible coal outcrops.
- Pinned world-template archive entries to a fixed timestamp so packaging
  identical content twice produces a byte-identical file. Recorded SHA-256
  values previously changed on every run and identified only which build wrote
  the artifact.
- Derived the world-template manifest contract version from `package.json`
  instead of a hard-coded literal, which had turned the `0.3.6` bump into a
  packaging failure.
- Added a `below=` line to `/skyknights:debug` reporting whether the space
  under the authored realm is void or ordinary terrain. The `0.3.5` playtest
  was run on a normal Infinite world with the development packs instead of a
  world created from the packaged template, and nothing in game said so.

### Added

- Added `npm run world-template:install`, which extracts the built template
  directly into Minecraft's `world_templates` folder. Double-clicking a
  `.mctemplate` does nothing when Windows has no handler registered for the
  extension, which is the case on the GDK Bedrock install this project targets;
  the file silently fails to import and never appears under Create New World.

### Changed

- Bumped the add-on, stable packs, world template, and GameTest dependency
  profile to `0.3.6`.
- Bumped the starter island content version to 7. An unmodified schema-5
  starter island rebuilds with the new prospects; player-modified and
  conservatively protected islands are never automatically overwritten.

### Validation

- `npm run verify` passed with 231 tests across 40 files, deterministic
  structures, TypeScript, NBT, the production `.mcaddon`, and both opt-in
  profiles.
- The starter island generates 18 iron ore, 8 coal ore, 16 oak logs, and a
  ten-block exposed boulder, with six ore columns visible in the grass surface.
- The packaged `.mctemplate` is 139,426 bytes with SHA-256
  `a05a446df94776161dc9e1c4efb6bb2ea984b8bcd8773d1a6ec252b821326811`.
- Visible discovery and the complete mining route remain Minecraft hands-on
  acceptance checks.

## [0.3.5] — 2026-07-27

### Added

- Added `npm run world-template:void`, which builds a fixed-seed Survival void
  source in an isolated sentinel-approved BDS installation, verifies
  full-height origin and distant chunks across a restart, and packages the
  current stable packs as `sky_knights_void_world.mctemplate`.
- Added a stable localized world-template manifest, short embedded-pack paths,
  exact world pack bindings, strict source metadata validation, and rejection
  of live or uncleanly closed source worlds.

### Fixed

- Added a five-block exposed stone boulder beside the starter workshop so the
  wooden-pickaxe to stone-pickaxe progression no longer depends on guessing
  that stone is buried beneath the grass.
- Added an authored-structure regression contract requiring every boulder
  block to be above the grass surface, exposed, and mineable.
- Bumped the starter island content version to 6. An unmodified schema-5
  starter island may rebuild; player-modified and conservatively protected
  islands are never automatically overwritten.

### Changed

- Bumped the add-on, stable packs, and GameTest dependency profile to `0.3.5`
  so the corrective playtest package is identifiable through
  `/skyknights:debug`.

### Validation

- `npm run verify` passed with 228 tests across 40 files, deterministic
  structures, TypeScript, NBT, the production `.mcaddon`, and both opt-in
  profiles.
- `npm audit --audit-level=high` reported zero vulnerabilities.
- BDS `1.26.34.3` loaded the `0.3.5` packs and passed the named skiff-seat
  smoke test.
- BDS `1.26.34.3` verified 1,671,168 air blocks across 17 full-height chunks
  and two boots. The final packaged source has seed `1702740741`, Survival
  mode, enabled debug commands, disabled experiments, and starter-dock spawn
  `(10, 161, 1)`.
- The 138,918-byte template contains 118 sorted root entries with no wrapper
  directory; SHA-256 is
  `9f9cfbf6292245df8ffb16a7fb248ed2af2f5665439c7c087b3c44c0461adb7c`.
- Visible placement and mining of the boulder remain a Minecraft hands-on
  acceptance check.
- Clean-client template import, starter arrival, save/reopen, and distant
  exploration remain Minecraft hands-on acceptance checks.

## [0.3.4] — 2026-07-27

### Added

- Added a deterministic, bounded ambient archipelago with more than 900
  possible planned locations across a roughly 5,376-block field and a
  persistence/performance cap of 384 generated outcomes.
- Added four compact solid `.mcstructure` templates for Verdant, Desert,
  Tundra, and Volcanic island families.
- Added lazy player-proximity generation, compact rederivable `a1` IDs,
  family clustering, central-realm protection, fixed altitude bands, and a
  single restart-safe generation transaction.
- Added occupied-volume protection so ambient generation skips rather than
  overwrites player builds, vanilla terrain, or an incomplete unknown
  structure.
- Added startup registry validation for every ambient template and debug output
  for generated count, cap, and the next nearby planned island.
- Added the procedural archipelago architecture guide and focused Minecraft
  hands-on test plan.

### Architecture

- Adopted a hybrid void-world + authored-template + deterministic Script API
  planner. Bedrock feature rules are retained as a later experimental
  decoration comparison, not the authoritative progression generator.
- Corrected the proposed custom-biome syntax: custom tags belong in
  `minecraft:tags`, and custom structures are connected through
  `minecraft:structure_template_feature` plus `minecraft:feature_rules`.
- Moved the opt-in custom-dimension proof to the stable
  `@minecraft/server` 2.8.0 dependency while retaining it as an isolated,
  unaccepted gameplay/migration strategy.
- Kept the stable target in `minecraft:overworld` for existing-world
  compatibility. Sky-only presentation still requires a new void source world
  and packaged `.mctemplate`.

### Validation

- `npm run verify` passed with 224 tests across 39 files, deterministic
  structures, TypeScript, NBT, the production `.mcaddon`, and both opt-in
  profiles.
- `npm audit --audit-level=high` reported zero vulnerabilities.
- BDS `1.26.34.3` loaded the packs without content errors and passed the
  existing named skiff-seat smoke test.
- Independent QA returned GO after player/entity placement races, global
  starvation, noncanonical IDs, unbounded diagnostics, and hands-on test
  reproducibility were corrected.
- Minecraft family clustering, restart behavior, occupied-volume protection,
  performance, and void-template presentation remain hands-on gates.

## [0.3.3] — 2026-07-27

### Fixed

- Moved the first iron and coal prospect into adjacent blocks on the walkable
  starter-island surface, with another block of each ore immediately below.
  The island retains its full 12-iron and 8-coal starter budget.
- Replaced the previous host-test definition of “exposed,” which accepted
  hard-to-read cliff-face seams below the plateau, with an exact
  surface-visibility regression contract.
- Bumped the starter island content version so an already schema-5 world whose
  tracked island is unmodified can rebuild the corrected structure. Migrated
  schema-4 and player-modified worlds remain protected from automatic
  restamping.

### Clarified

- Documented that ordinary Overworld terrain is generated by Minecraft below
  the high authored islands. The stable sky-only experience requires a new
  void-world template; existing worlds are never cleared or silently
  converted.

### Validation

- `npm run verify` passed with 209 tests across 35 files, deterministic
  structure checks, TypeScript, NBT, the production `.mcaddon`, and both
  opt-in profiles.
- `npm audit --audit-level=high` reported zero vulnerabilities.
- BDS `1.26.34.3` loaded the corrected packs without content errors and passed
  the existing named skiff-seat smoke test. This does not prove starter-resource
  visibility in a real client.
- Independent QA returned GO after the migration policy conservatively
  protected every pre-schema-5 generated island from automatic restamping.
- Fresh-world surface visibility and void-template presentation remain
  hands-on acceptance gates.

## [0.3.2] — 2026-07-27

### Added

- Developer test bench: `/skyknights:testbench` places a labelled, restockable
  row of eight stocked barrels north of the home dock so any ship, module, or
  combat system can be exercised without playing the progression chain.
  `/skyknights:testbench_clear` removes it. Documented in
  [`docs/TEST_BENCH.md`](docs/TEST_BENCH.md).
- `/skyknights:objective` recalls the current objective. Unlike the other
  development commands it is available to all players and needs no cheats,
  because the objective was previously unrecoverable once it scrolled out of
  chat.
- A paced first-run introduction that explains the floating island, that void
  falls return the player to the dock, where Dockmaster Elian is, and the
  overall goal, ending with a title card and the first objective.
- Objective changes now show a title card and an action-bar line in addition to
  the chat message.
- `tests/testbench.test.ts` asserts the bench row stays on the island surface,
  clear of the dock, evenly spaced, and stocked with every custom ship part,
  module, and progression item.
- Integrated the bounded player-built Skycraft prototype: five dock
  certifications, deterministic connected-block scanning, strict canonical
  blueprints, fixed-point mass/lift/thrust engineering, directional engines,
  authored flight proxies, exact docking, and restart-safe transactions.
- Added 18 localized placed Skycraft components and survival recipes, including
  Helm/Core, lift sails, airbags, compact lift cells, four propulsion families,
  seats, cargo reserve, repair, cannon, and shield hardpoints.
- Added eight editable reference fixtures: Minnow, Dart, Cargo Punt,
  Cloudwhale, Aether Disc, Frostwing, Surveyor, and Grand Cruiser.
- Added owner-scoped saved blueprints with bounded storage, optimistic
  revisions, fresh-ID materialization, exact material consumption, and
  inventory/world rollback.
- Added player-built crew permissions, certified-seat enforcement, persisted
  hull/subsystem damage, Repair Kit relaunch gates, destruction recovery, and
  owner/gunner Cannon Hardpoint use.
- Activated guaranteed deterministic caches on the five seeded islands,
  including two Relic Shards and the Aether Core needed by the prototype
  certification ladder.
- Added the focused
  [`docs/SKYCRAFT_HANDS_ON_TEST_PLAN.md`](docs/SKYCRAFT_HANDS_ON_TEST_PLAN.md)
  and an implementation/gate tracker.

### Changed

- Rewrote all twelve tutorial objective strings to state where to go and what
  to do, and replaced the player-facing internal slice name
  ("Crystal-to-Cutter expedition is active") with plain language.
- Bumped the visible add-on/package version to `0.3.2`.
- Kept unmeasured certifications behind the explicit
  `skyknights.skycraft_experimental` tester tag. Apprentice remains the only
  normally exposed player-built certification until performance and device
  gates pass.
- Kept player-built physical cargo disabled; cargo racks currently reserve
  engineering mass and capacity only.

### Validation

- `npm run verify` passed with 207 tests across 35 files, authored-structure
  checks, TypeScript build, NBT tests, production `.mcaddon`, and both opt-in
  profiles.
- `npm audit --audit-level=high` reported zero vulnerabilities.
- BDS `1.26.34.3` loaded the dirty integrated stable/GameTest packs without
  content errors and passed the existing named skiff-seat GameTest. This is
  pack-load evidence, not Skycraft reconstruction or interaction proof.
- Independent QA returned GO after fixes for owner-only launch, component
  certification, pre-mount authorization and certified-seat limits, the
  active-craft cap, and strict persisted-record validation.
- Minecraft hands-on, multiplayer, input, migration, and device evidence
  remains pending.

## Skycraft architecture roadmap — 2026-07-26

- Added the player-built skycraft technology roadmap: bounded wood-block
  airframes, Helm-centered canonical blueprints, mass/lift/thrust rules,
  directional engines, Airbag dirigibles, compact Aether craft, multiplayer
  roles, atomic recovery, performance gates, and phased delivery.
- Added technology-gated Dockmaster reference blueprints and personal blueprint
  rules so players may buy/build tested designs without bypassing the same
  materials, progression, validation, or ownership contracts as custom craft.
- Revised the future Phase 5 direction while preserving the existing
  Skiff/Skycutter as shipping prototypes and migration-compatible legacy craft.
  No player-built skycraft runtime capability is claimed by this documentation
  slice.

## [0.3.1] — 2026-07-26

### Added

- Starter-island resource and integrity corrective slice: two visible oak
  trees, 12 exposed iron ore, 8 exposed coal ore, abundant stone, and a placed
  crafting table and furnace.
- A host-side starter-resource budget contract that ties the authored structure
  to the starter-skiff recipes and Dockmaster material requirements.
- Clearer Dockmaster and tutorial directions for the starter resources,
  workstation, furnace, and first skiff assembly.
- A guarded, opt-in BDS `1.26.34.3` two-boot smoke harness with bounded world
  and pack ownership, `level.dat` fixture tests, exact GameTest result parsing,
  retained run evidence, and failure-safe server configuration restoration.
- Vendor-neutral BDS/GameTest validation and independent safety-review roles.
- Host contracts for the BDS runtime GameTest dependency and recipe-unlock
  syntax.

### Fixed

- Corrected the starter island's runtime integrity probe to expect the authored
  oak-plank dock rather than grass. In reported `0.3.0` test 4, the island was
  visibly placed but its job remained `queued`; safe arrival and manual recovery
  correctly deferred while the false integrity check prevented completion.
- Changed the GameTest manifest dependency to the `1.0.0-beta` runtime version
  exposed by BDS while retaining the build-specific npm type package.
- Changed all custom `AlwaysUnlocked` recipes to the context-object form
  accepted by BDS `1.26.34.3`, eliminating pack-load recipe errors.

### Automated evidence

- `npm run verify` passed with 153 host tests across 19 files, NBT fixture
  tests, production add-on packaging, and both opt-in profile builds.
- `npm run test:bds:smoke` passed on BDS `1.26.34.3`; both packs loaded without
  content errors and
  `skyknights:skiff_has_pilot_and_passenger_seats` reported the exact
  `onTestPassed` marker.
- The hardened smoke passed again from clean commit `9e725c0` with
  `gitDirty: false`; server properties were restored and no runner process,
  lock, backup, or temporary properties file remained.
- `npm audit --audit-level=high` reported zero vulnerabilities.

### Pending validation

- Retest the fresh-world bootstrap and starter-to-skiff route in Minecraft;
  no `0.3.1` hands-on pass is recorded yet.
- Add broader BDS coverage, beginning with one bounded `SimulatedPlayer`
  interaction/mounting test; the current smoke runs one component GameTest.

## [0.3.0] — 2026-07-26

### Added

- Automatic sequential bootstrap for the released starter island, Ember
  Outpost, and Frostspire.
- Ticking-area readiness polling and post-placement integrity polling before an
  island is marked generated.
- Automatic generation retry with backoff for transient runtime failures, and
  indefinite safe first-player arrival retry until the starter island is ready.

- Deterministic four-family island registry with purpose-separated seeded
  random streams, reserved bounds, travel-lane checks, and pinned migration
  safety for the three released islands.
- Five packaged authored structures: Sunspire Reach, Verdant Hollow, Glacier
  Vault, Ashfall Crater, and Aether Sanctum.
- World profiles and schema-5 persistence for derived world seed, layout
  version, per-island placements, reserved bounds, and player-modified state.
- Destination pre-generation/readiness services with explicit inactive and
  profile-excluded states.
- Progression-closure, layout, migration, discovery, content-contract, and
  generated-structure verification.
- Vendor-neutral multi-agent development instructions and a focused
  [`Phase 3 Stabilization Test Plan`](docs/PHASE_3_STABILIZATION_TEST_PLAN.md).

### Changed

- The island registry is the single source for legacy and new island geometry,
  identifiers, anchors, integrity probes, and activation state.
- The generation service resolves persisted origins for every registry island
  and protects player-modified islands from automatic content-version
  restamping.
- Startup validation now covers all packaged island structures and stops
  runtime initialization when required content is missing.
- `npm run verify` checks generated structures without rewriting the worktree.
- Debug output reports schema-5 seed/profile/layout data and every persisted
  island origin.
- Fresh world-state creation uses the deterministic default seed rather than a
  runtime-random seed; local deployment accepts optional `.env` defaults.
- `/skyknights:island` now safely resumes starter-island bootstrap when needed;
  it does not force a terrain-restamping recovery.

### Fixed

- Removed executable content references to unimplemented Phase 3 items and
  creatures.
- Preserved existing chest inventory when its marker item is still present
  instead of resetting the chest block before the idempotency check.
- Replaced duplicate island registry fragments with one typed source of truth.
- Updated the progression test to inspect the declarative content table instead
  of regex-scanning the old effectful implementation.
- Addressed the reported Phase 3 fresh-world failure where the starter island
  appeared only after `/skyknights:island`, the initial player required manual
  recovery, and Ember Outpost and Frostspire never generated.

### Automated evidence

- `npm run verify` passed with 147 host tests across 17 files.
- `npm audit --audit-level=high` reported zero vulnerabilities.

### Pending validation

- Complete the `0.3.0` Phase 3 bootstrap, schema-5, deterministic-layout,
  inactive-content, and player-modification hands-on plan. The reported
  fresh-world Session C failure is fixed in code but has not yet been retested
  in Minecraft.
- Complete the `0.2.0` hands-on Dockyard Refit and Airship Combat plan.
- Complete controller, touch, multiplayer, clean-client import, and
  world-template import gates.
- Record balance observations for module costs, cannon combat, and Raider AI.

## [0.2.0] — 2026-07-26

### Added

- Dockmaster refit forms for owner-only, dock-only Skycutter module swaps.
- A data-driven module registry covering the four ship slots.
- Armored Hull with 180 maximum hull and damage reduction.
- Frostfire Engine with extended range and improved flight speed.
- Expanded Cargo Hold with 27 inventory slots and safe downgrade protection.
- Aether Cannon, reusable Cannon Control, and craftable Aether Charges.
- Server-authoritative aimed cannon fire, cooldowns, ammunition consumption,
  hit feedback, and persistent combat counters.
- Persistent Ashwing Raider airship encounter with ranged attacks, recovery,
  shared world state, and a developer reset command.
- Raider Core delivery and Shield Projector reward.
- Conditional Skycutter geometry for armor, cargo, cannon, and shield modules.
- Ashwing Raider entity geometry and resources.
- Five advanced-module/ammunition recipes and eight new custom items.
- Four in-engine GameTests, including expanded cargo and Raider hull checks.
- Focused
  [`Dockyard Refit and Airship Combat Test Plan`](docs/DOCKYARD_REFIT_COMBAT_TEST_PLAN.md).

### Changed

- Stable Behavior and Resource Packs advanced to version `0.2.0`.
- World, player, and ship documents advanced to schemas `4`, `3`, and `3`.
- Legacy completed players migrate into the combat-refit progression.
- Ember Outpost advanced to content version `4`, with 24 guaranteed iron and
  8 guaranteed redstone.
- Frostspire advanced to content version `2`, with 16 guaranteed Froststeel.
- Skycutter configuration is reapplied when its entity loads.
- Diagnostics now report Raider state, installed modules, and combat counters.
- Startup validation now covers every refit/combat entity and item.

### Fixed

- Refit transactions preserve both the replacement and removed module if a
  swap cannot finish.
- Expanded cargo cannot be removed while slots 19–27 contain items.
- Lost Cannon Controls can be reissued by selecting the installed cannon at
  the Dockmaster.
- A missing active Raider can recover without creating a normal second
  encounter.

### Automated evidence

- `npm run verify` passed.
- 25 host-side tests passed across 8 test files.
- Stable, production, experimental, and GameTest builds completed.
- `npm audit --audit-level=high` reported zero vulnerabilities.
- The stable packs were deployed successfully to the local Bedrock
  development-pack folders.

## [0.1.0] — 2026-07-26

Git baseline: `3a2a27e` (`feat: add crystal-to-cutter playtest slice`).

### Added

- Solid Verdant starter island, Ember Outpost, and Frostspire authored
  structures with resumable, content-versioned placement.
- Self-healing Dockmaster Elian and guided tutorial objectives.
- Craftable two-seat starter skiff with native three-dimensional flight.
- Aether Crystal expedition and four-slot, four-seat Skycutter assembly.
- Persistent owned-ship references, pilot arbitration, 18-slot cargo,
  extended-range travel, hull damage, repair, recall, destruction, and
  reconstruction.
- Guaranteed progression loot and the Crystal-to-Cutter objective chain.
- Development commands for debugging, ship spawning, island rebuilding, and
  recovery.
- Stable world-template packaging, experimental custom-dimension profile, and
  opt-in GameTest profile.
- Focused Phase 0, Phase 2, and Crystal-to-Cutter test plans.

### Fixed during hands-on validation

- Registered custom commands so `/skyknights:debug` loads correctly.
- Made starter-island regeneration deterministic and substantially solid.
- Corrected skiff launch height and collision/mounting behavior.
- Preserved the starter island and Dockmaster across reloads.
- Restored a missing Dockmaster at the starter dock.
- Corrected the Skycutter named-slot module type error in `skiff.ts`.

### Validation

- The user confirmed starter-island restoration, skiff mounting and movement,
  island regeneration, and the Crystal-to-Cutter playtest path.
- Host-side checks and production packaging passed before the baseline commit.

## [0.0.1] — 2026-07-25

Git baseline: `07ecfe2` (`chore: scaffold Bedrock development environment`).

### Added

- Behavior Pack, Resource Pack, TypeScript, tests, CI, and VS Code scaffold.
- Fixed pack UUIDs, stable Script API pins, local deployment, debugger, and
  packaging commands.
- Architecture roadmap, development-environment notes, and initial decisions.

### Changed

- Replaced the deprecated Mojang task-runner dependency chain with
  repository-owned build tooling using TypeScript, esbuild, Prettier, and
  fflate.
- Added explicit install-script approval for the pinned esbuild version.

### Security

- Removed inherited deprecated `inflight`, `glob@7`, `rimraf@3`, and
  `@types/chokidar` dependencies.
- Reduced the reported ten high-severity npm findings to zero.
