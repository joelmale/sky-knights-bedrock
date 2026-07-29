# Sky Knights: Bedrock

Minecraft Bedrock add-on implementing the floating-island exploration, progression, combat, and airship fantasy of Sky Knights.

The repository is based on Microsoft/Mojang's TypeScript starter, updated for Minecraft Bedrock 1.26.30+ and the stable Script API shipped with that release.

## Prerequisites

- Windows 10 or 11
- Minecraft Bedrock for Windows
- Git
- Node.js 24 LTS recommended; Node.js 20 or newer supported by this project
- Visual Studio Code
- Minecraft Bedrock Debugger VS Code extension
- Blockception's Minecraft Bedrock Development VS Code extension

Minecraft Creator Tools (`mctools.dev` or its CLI) is optional. The build does not require it.
Bedrock Dedicated Server `1.26.34.3` is optional and used by the opt-in
GameTest smoke and validated void-template workflows.

## First setup

```powershell
git clone https://github.com/joelmale/sky-knights-bedrock.git
cd sky-knights-bedrock
npm ci
npm run check
npm run local-deploy
```

`local-deploy` builds the TypeScript and copies the Behavior and Resource Packs to the development pack folders. `.env` may override the Minecraft product; when absent, the repository uses its documented GDK default. Leave it running to rebuild on file changes.

This machine uses the GDK Bedrock location:

```text
%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang\
```

The deploy task creates and uses:

```text
development_behavior_packs\sky_knights
development_resource_packs\sky_knights
```

## Load the pack in Minecraft

1. Run `npm run local-deploy`.
2. Start Minecraft Bedrock.
3. Create a test world with cheats enabled.
4. Open Behavior Packs → My Packs.
5. Activate **Sky Knights Behavior Pack**. Its Resource Pack dependency should activate with it.
6. Enter the world.
7. Confirm the message `Sky Knights development pack is active.`

In Minecraft, enable **Content Log File** and **Content Log GUI** under Settings → Creator. Use `/reload` after compatible content changes; restart the world when manifests or some entity definitions change.

## Debug TypeScript

One-time setup from an elevated PowerShell:

```powershell
npm run enablemcloopback
```

Then:

1. Run the `deploy` task or `npm run local-deploy`.
2. Press F5 in VS Code and select **Debug Sky Knights in Minecraft**.
3. Enter the test world.
4. Run `/script debugger connect`.
5. Set breakpoints in `scripts/**/*.ts`.

The debugger listens on port `19144` and uses the source maps under `dist/debug`.

## Commands

```text
npm run build                 Type-check and bundle scripts
npm run lint                  Lint TypeScript
npm test                      Run host-side unit tests
npm run test:bds:unit         Test the Bedrock level.dat/NBT tooling
npm run test:bds:smoke        Run the opt-in BDS/GameTest smoke harness
npm run test:bds:void-source  Build and full-height scan an isolated void source
npm run check                 Lint, build, and test
npm run local-deploy          Build/deploy and watch for changes
npm run build:profiles        Build opt-in experimental and GameTest packs
npm run local-deploy:experimental
                              Deploy the custom-dimension proof
npm run local-deploy:gametest Deploy the in-engine GameTest pack
npm run mcaddon               Build an importable development .mcaddon
npm run mcaddon:production    Build a production .mcaddon
npm run structures:generate   Rewrite authored structures from deterministic sources
npm run structures:check      Verify checked-in structures without rewriting them
npm run world-template -- --world "<path>"
                              Package a canonical validated void source
npm run world-template:void   Build, validate, and package the void realm
npm run world-template:install
                              Install the built template into Minecraft
npm run verify                Run all checks and package production output
```

Packaged output is written to:

```text
dist/packages/sky_knights.mcaddon
dist/world-template/sky_knights_void_world.mctemplate
```

## Project layout

```text
behavior_packs/sk_bp/   Server-side pack data and compiled script target
resource_packs/sk_rp/   Client assets, text, geometry, animation, and sound
scripts/                TypeScript source
tests/                  Host-side unit tests for deterministic/pure logic
docs/                   Decisions and environment notes
tools/bds/              Guarded opt-in BDS/GameTest validation harness
```

See [BEDROCK_ADDON_ROADMAP.md](BEDROCK_ADDON_ROADMAP.md) for the full implementation plan.

## Project tracking

- [Current implementation status](docs/PROJECT_STATUS.md)
- [AI development handoff and next slice](docs/AI_HANDOFF.md)
- [Version changelog](CHANGELOG.md)
- [Automated and hands-on validation log](docs/VALIDATION_LOG.md)
- [Architecture decisions](docs/DECISIONS.md)
- [Product roadmap](BEDROCK_ADDON_ROADMAP.md)
- [Player-built skycraft technology roadmap](docs/SKYCRAFT_TECHNOLOGY_ROADMAP.md)
- [Skycraft implementation and gate tracker](docs/SKYCRAFT_IMPLEMENTATION_STATUS.md)
- [Skycraft hands-on test plan](docs/SKYCRAFT_HANDS_ON_TEST_PLAN.md)
- [Aether Outrigger hands-on test plan](docs/AETHER_OUTRIGGER_TEST_PLAN.md)
- [Procedural archipelago architecture](docs/PROCEDURAL_ARCHIPELAGO.md)
- [Procedural archipelago hands-on test plan](docs/ARCHIPELAGO_HANDS_ON_TEST_PLAN.md)

The status tracker distinguishes implemented code, automated verification, and
Minecraft hands-on acceptance. Update the implementation, changelog, validation
evidence, and focused test plan together for each feature slice.

## Optional BDS/GameTest smoke validation

The repository includes a guarded two-boot Bedrock Dedicated Server harness. It
stages copies of the stable and GameTest packs into a dedicated, externally
downloaded BDS `1.26.34.3` installation, creates only its fixed disposable
world, and runs one registered GameTest. It is not part of normal CI and does
not replace hands-on Minecraft testing.

See the [BDS/GameTest Harness guide](docs/BDS_GAME_TEST_HARNESS.md) before
creating the required test-root sentinel or running:

```powershell
npm run test:bds:smoke
```

The same sentinel-approved external BDS installation can build and validate
the packaged sky-only world without reading or changing Minecraft client
worlds:

```powershell
npm run world-template:void
```

See the [void-world template guide](docs/VOID_WORLD_TEMPLATE.md) for its safety
contract, automated evidence, and clean-client acceptance steps.

## Playable Dockyard Refit and Airship Combat slice

The `0.3.6` playtest build retains the `0.2.0` two-expedition survival
progression into dockyard refitting and airship combat:

1. Start on a solid Verdant home island and assemble a two-seat starter skiff.
2. Fly to Ember Outpost and return its guaranteed Aether Crystal to Dockmaster
   Elian.
3. Craft Hull, Cargo, and Navigator modules around the awarded Aether Engine.
4. Assemble a persistent four-seat Skycutter with an 18-slot cargo hold.
5. Cross the starter craft's range boundary, raid Frostspire, and return
   Froststeel in the ship's cargo.
6. Craft and atomically install advanced Hull, Engine, Cargo, and Utility
   modules while the owned Skycutter is secured at the dock.
7. Equip the Aether Cannon, load Aether Charges, and defeat the persistent
   Ashwing Raider encounter.
8. Return its Raider Core for a defensive Shield Projector.
9. Use dock recall, repair, and reconstruction to maintain the owned ship.

The current development checkpoint uses world schema 5. It retains the schema-4
Raider encounter and island content versions, then adds a derived world seed,
profile, deterministic layout records, and player-modified island protection.
Player and ship schemas remain version 3. Opening an older test world preserves
the three released island origins, ships, progression, and encounter state
while recording the expanded realm layout.

Five additional authored islands are deterministically placed and can stock
their guaranteed gray-box progression caches. Their final custom creature,
boss, reveal, art, and balance layers remain incomplete and are tracked
separately from the built structures/rewards.

On a fresh supported world, the three released islands generate automatically
in order: starter island, Ember Outpost, then Frostspire. The initial player is
held until the starter island passes its readiness and integrity checks, then is
moved to the safe dock automatically. Transient generation failures retry with
backoff. This behavior is covered by automated verification but remains pending
Minecraft hands-on acceptance for `0.3.6`.

The starter island supplies at least 2.5x what the first-skiff route spends,
and supplies it where a player on foot can reach it: four oak trees (16 logs),
18 iron ore, 8 coal ore, a ten-block surface boulder, and a placed crafting
table and furnace. Six ore columns break the grass surface — four iron and two
coal — each continuing straight down, with shallow pockets a few blocks under
the clearing. No starter ore is placed on the island's underside, which cannot
be mined before the ship that ore pays for. The player still crafts the Ship
Core, Canvas Bundles, and Thruster Module from those raw resources; the
Dockmaster does not grant ship components directly.

The stable add-on cannot replace normal Overworld terrain generation. A
regular world therefore continues generating vanilla land below the high
islands. The intended sky-only presentation uses a new void-world template,
where the authored and procedural-template structures are the landmass.
Existing normal worlds are never cleared or silently converted.

`npm run world-template:void` now creates that template from an isolated,
fixed-seed BDS world, scans origin and newly generated distant chunks through
the complete Overworld height, and embeds the stable packs. Clean-client
Minecraft import remains a hands-on release gate.

`0.3.4` adds a bounded procedural archipelago around the protected authored
realm. More than 900 possible deterministic locations are divided into
Verdant, Desert, Tundra, and Volcanic visual clusters. Nearby islands generate
one at a time from compact `.mcstructure` templates as players explore, with a
first-release cap of 384 persisted outcomes and occupied-volume protection.
See the [architecture](docs/PROCEDURAL_ARCHIPELAGO.md) and
[hands-on plan](docs/ARCHIPELAGO_HANDS_ON_TEST_PLAN.md).

### Player-built Skycraft prototype

`0.3.4` includes the integrated bounded Skycraft prototype beside the unchanged
legacy Skiff and Skycutter. Build an approved connected wood airframe around
exactly one Helm and Ship Core in the east dock berth. The Helm reports mass,
required lift, thrust, control, seats, hull, cargo reserve, hardpoints, and the
current certification cap. A successful launch persists and clears the exact
docked blueprint, creates an authored flight proxy, and restores the approved
blocks and states when docked.

Dockmaster Elian offers eight editable reference plans and inventory-consuming
construction orders. Owners can save certified designs to a bounded personal
library and rematerialize them with a fresh registration. Crew roles,
certified seats, damage/repair bills, destruction recovery, and Cannon
Hardpoints are integrated.

Only Apprentice is exposed in ordinary playtesting. To expose every
provisional certification and reference fixture in a cheats-enabled test
world:

```mcfunction
/tag @s add skyknights.skycraft_experimental
```

Physical cargo remains intentionally disabled for player-built craft. Cargo
racks currently reserve engineering mass and capacity; they do not transfer or
store items in flight. See the
[implementation tracker](docs/SKYCRAFT_IMPLEMENTATION_STATUS.md) and
[focused test plan](docs/SKYCRAFT_HANDS_ON_TEST_PLAN.md) before interpreting
prototype code or assets as a completed release.

Development commands:

```text
/skyknights:skiff            Developer shortcut: spawn a test skiff
/skyknights:skycutter        Developer shortcut: spawn a configured Skycutter
/skyknights:outrigger        Spawn the Aether Outrigger art/handling prototype
/skyknights:blimp            Spawn the Steampunk Blimp art/animation prototype
/skyknights:debug            Show schema, generation, input, and entity state
/skyknights:island           Safely resume required-island bootstrap when needed
/skyknights:archipelago_pause
                             Pause new ambient-island jobs for safety testing
/skyknights:archipelago_resume
                             Resume new ambient-island jobs
/skyknights:raider           Reset and spawn the Ashwing Raider for development
/skyknights:recover          Return to the last safe dock
/skyknights:testbench        Place the stocked test-bench row on the home island
/skyknights:testbench_clear  Remove the test-bench row
/skyknights:objective        Show the current objective (available to all players)
```

### Test bench

`/skyknights:testbench` places a labelled row of stocked barrels on the grass
north of the home dock so a tester can exercise any ship, module, or combat
system without playing the progression chain first. Each barrel carries a sign
naming its contents:

```text
Starter Parts | Skycutter Base | Advanced Modules | Cannon + Ammo
Shield + Repair | Progression Items | Raw Materials | Survival Kit
```

The row is placed on demand rather than baked into
`starter_island.mcstructure`, because changing authored starter terrain would
require an explicit content-version and existing-world replacement decision.
Re-running the command restocks only recorded bench-owned barrels, and a stall
whose support, target cells, ownership marker, or labelled sign does not match
is skipped rather than overwriting a player build.

See [docs/TEST_BENCH.md](docs/TEST_BENCH.md) for the per-stall inventory and
the suggested per-system test recipes.

Run the focused
[Dockyard Refit and Airship Combat test plan](docs/DOCKYARD_REFIT_COMBAT_TEST_PLAN.md)
before treating the new progression as accepted in-engine. The
[Crystal-to-Cutter test plan](docs/CRYSTAL_TO_CUTTER_TEST_PLAN.md) remains the
base progression regression pass, and the earlier
[Phase 2 Playtest](docs/PHASE_2_PLAYTEST.md) remains the shorter starter-skiff
check.

The custom-dimension and GameTest packs are opt-in capability profiles.
Custom-dimension registration is stable in `@minecraft/server` 2.8.0, but its
Sky Knights migration and gameplay contracts remain unaccepted; GameTest still
uses its separate beta runtime module. See
[docs/HANDS_ON_TEST_PLAN.md](docs/HANDS_ON_TEST_PLAN.md) for the complete
keyboard, controller, touch, reload, multiplayer, GameTest, experimental
dimension, and world-template validation sessions. The shorter
[docs/PHASE_0_VALIDATION.md](docs/PHASE_0_VALIDATION.md) remains the acceptance
checklist.

Entity-art prototypes have focused client test plans:

- [Aether Outrigger](docs/AETHER_OUTRIGGER_TEST_PLAN.md)
- [Steampunk Blimp](docs/STEAMPUNK_BLIMP_TEST_PLAN.md)

Substantial future slices use the vendor-neutral
[multi-agent development workflow](docs/MULTI_AGENT_WORKFLOW.md): one central
architect/integrator, bounded lower-cost specialists with exclusive file
ownership, and an independent QA review before verification and commit.

## API policy

- Stable APIs are the default.
- Exact Minecraft module versions are pinned in `package.json` and the Behavior Pack manifest.
- Beta APIs require an explicit build profile and an architecture decision.
- Shipped identifiers use the `skyknights` namespace and are never reused for a different concept.

No redistribution license has been selected yet. Treat the repository as private until one is added.
