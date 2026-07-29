# Project Status

> Last updated: 2026-07-28
>
> Current playtest version: `0.3.10`
>
> Stable API baseline: Minecraft Bedrock 1.26.30+, `@minecraft/server` 2.8.0,
> `@minecraft/server-ui` 2.1.0
>
> Current state: the `0.2.0` legacy ship/combat loop, `0.3.1` deterministic
> realm stabilization, the bounded player-built Skycraft prototype, and the
> `0.3.4` clustered procedural-template archipelago, the `0.3.5` visible
> starter-stone correction, the automated fixed-seed void-world template
> pipeline, the `0.3.6` reachable 2.5x starter resource budget, the `0.3.7`
> dock-destruction response, a summon-only Aether Outrigger art/handling
> prototype, the `0.3.8` varied procedural archipelago, a separate summon-only
> four-seat Steampunk Blimp art/animation/handling prototype, and the `0.3.9`
> large-prototype scale/camera accessibility correction, plus the `0.3.10`
> Fibonacci-annulus and useful-area ambient-island correction are integrated.
> Repository evidence is green; Minecraft altitude, continent, fire, entity
> rendering, seating, camera, flight, reload, multiplayer, migration,
> performance, and device gates remain.
>
> Archipelago hands-on Sessions A, A2, and B passed on a `0.3.6` void-template
> world. The `0.3.8` variety and `0.3.10` scale/distribution changes have not
> been exercised in Minecraft;
> Sessions B-G, the Phase 3 migration matrix, Skycraft acceptance, and the
> device/multiplayer matrix remain. The Dockmaster hostile transformation and
> both the Aether Outrigger and Steampunk Blimp remain hands-on gates.

This is the authoritative implementation tracker. The roadmap describes the
target product; this document records what the repository currently delivers.
Release history is in [`CHANGELOG.md`](../CHANGELOG.md), and test evidence is
in [`VALIDATION_LOG.md`](VALIDATION_LOG.md).

## Milestone status

| Roadmap milestone                           | Status                                               | Evidence and remaining work                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 — capability proofs                 | Substantially implemented                            | Stable packs, entity flight, authored structures, persistence, GameTest, version-gated BDS smoke and void-source runners, a packaged fixed-seed void template, and an opt-in custom-dimension profile exist. SimulatedPlayer depth, controller/touch, clean-client template import, and the complete capability matrix remain open.                                                                                                                                                      |
| Phase 1 — production scaffold               | Implemented                                          | Repeatable lint/build/test/deploy/package commands, startup registry validation, structured logging, diagnostics, CI, and fixed dynamic-property repositories are present.                                                                                                                                                                                                                                                                                                               |
| Phase 2 — gray-box vertical loop            | Implemented and hands-on exercised                   | Solid home island, Dockmaster, crafting, Ember expedition, starter skiff, rescue, persistence, and safe return were exercised during development. Full multiplayer/input matrix remains open.                                                                                                                                                                                                                                                                                            |
| Phase 3 — deterministic sky realm           | Runtime/content integrated; variety hands-on pending | Schema 5, deterministic authored layout, three pinned and five seeded progression islands, four ambient families across four solo tiers and five altitude bands, six sparse continent sites, and a BDS-validated fixed-seed void template exist. Placement, obstruction safety, multipart resume, retry/backoff, safe arrival, guaranteed caches, discovery, and progression closure are integrated. Client variety, fire, continent performance, reload, and migration evidence remain. |
| Phase 4 — progression/combat/NPC depth      | Partially implemented                                | Guaranteed Crystal/Froststeel progression, tutorial, Dockmaster, Frostspire Warden, and Ashwing Raider exist. Full tool ladder, four NPC roles, structure set, creature roster, and named weapons remain.                                                                                                                                                                                                                                                                                |
| Phase 5 — player-built skycraft             | Integrated prototype; external gates pending         | Helm-connected custom airframes, canonical blueprints, mass/lift technology, directional engines, authored proxies, atomic reconstruction/recovery, five certifications, 18 components, eight references, personal saves, roles, damage/repair, and combat are integrated. Physical cargo, navigation, shared-dock depth, retrofit, final content/art, and acceptance gates remain.                                                                                                      |
| Phases 6–7 — content complete and hardening | Not started as milestones                            | Packaging infrastructure exists, but final art/content, balance, localization breadth, performance, device matrix, migrations from public builds, and release-candidate checks remain.                                                                                                                                                                                                                                                                                                   |

## Implemented gameplay path

The current no-command Survival path is:

```text
Verdant Isle resources
  → starter components
  → Dockmaster assembles starter skiff
  → Ember Outpost Aether Crystal
  → four-slot Skycutter
  → Frostspire Froststeel
  → advanced dockyard modules
  → Aether Cannon and charges
  → Ashwing Raider battle
  → Raider Core
  → Shield Projector
```

Developer commands are diagnostics and recovery aids; normal progression does
not require them.

## Current content inventory

| Content type       | Implemented                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Authored islands   | 8 progression templates plus 26 frozen run-2 and 28 active run-3 ambient source templates                 |
| Custom entities    | Dockmaster, starter skiff, Skycutter, Aether Outrigger, Steampunk Blimp, Ashwing Raider, Skycraft proxy   |
| Custom items       | 20 legacy/progression items plus 18 placeable Skycraft block-items                                        |
| Custom recipes     | 30                                                                                                        |
| Ship frames        | Starter skiff, Skycutter, eight editable Skycraft reference fixtures                                      |
| Skycutter slots    | Hull, Engine, Cargo, Utility                                                                              |
| Standard modules   | Reinforced Hull, Aether Engine, Cargo Hold, Navigator Module                                              |
| Advanced modules   | Armored Hull, Frostfire Engine, Expanded Cargo Hold, Aether Cannon, Shield Projector                      |
| Encounters         | Ember Guardian, Frostspire Warden, Ashwing Raider                                                         |
| GameTests          | 4 registered; 1 executed by the opt-in BDS smoke harness                                                  |
| Host tests         | See the current `0.3.10` verification snapshot below                                                      |
| Developer commands | `debug`, `skiff`, `skycutter`, `outrigger`, `blimp`, `island`, `raider`, `recover`, test bench, objective |

## Systems implemented

### Build, packaging, and security

- Exact stable Minecraft module versions and fixed pack UUIDs.
- TypeScript type checking and esbuild bundling.
- Prettier-based linting and host-side Vitest suite.
- Stable `.mcaddon`, opt-in experimental `.mcpack`, opt-in GameTest `.mcpack`,
  and world-template packaging.
- Guarded two-boot BDS `1.26.34.3` smoke validation with fixed managed paths,
  exact module/pack bindings, NBT fixture coverage, content-error rejection,
  retained artifacts, and exact GameTest pass markers.
- Guarded BDS void-source creation with fixed seed, Survival/debug defaults,
  a starter-dock spawn, disabled experiments, complete-height origin and
  distant-chunk scans, restart persistence, source hashing, and recoverable
  publication.
- Local one-shot or watched deployment to Minecraft Bedrock GDK folders.
- CI verification workflow.
- No current npm audit findings; only the exact pinned esbuild install script
  is approved.

### World generation and recovery

- Authored `.mcstructure` placement through a resumable generation queue.
- Four-family deterministic registry with three permanently pinned islands and
  five seeded island placements.
- Active `a3` planner with 2,563 Fibonacci-cohort/golden-angle candidates from
  radius 600–3,200, eight family hubs, four size tiers, five altitude bands,
  complete-footprint 460-block authored-realm exclusion, and a 224-solo
  persistence/performance cap.
- Reference 512-block windows contain approximately 2.0–2.6× the frozen `a2`
  candidate density. Runtime queries 768 blocks so the inner cohort can prepare
  from the central realm.
- Run-3 solo tiers provide 9.15–11.09× their prior usable top area. Islets and
  Standards are single structures; Crags use four bounded parts and Landmarks
  sixteen. Every unique placement remains below 50,000 bounding cells and
  11,000 solid blocks.
- Six sparse continent sites, each composed from 21 seam-safe parts; at most
  two generate in one world.
- Lazy nearby solo placement uses compact `a3_<base36>` IDs, per-island
  observer clearance, occupied-volume protection, and one persisted job at a
  time. Multipart jobs checkpoint every part and load only one row at once.
- Existing `a1` and `a2` terrain remains untouched and outside the `a3` solo
  cap. Valid in-flight legacy jobs still finish against their original
  templates. The six `a2` continent sites remain active and reserve their
  complete footprint against run-3 solos.
- Run-2 rare volcanic ember and bounded reactive-pyre structures remain
  packaged for compatibility. New run-3 large solo selection does not yet have
  burn-content parity and this is tracked as partial rather than implied.
- Persisted world profile, layout seed, layout version, origins, reserved
  bounds, and sticky player-modified protection.
- Island activation remains explicit; all eight current structures are
  `ready`, while final custom creatures/bosses stay marked planned in the
  content matrix rather than being implied by terrain or cache activation.
- Per-island content versions and integrity checks.
- Automatic starter → Ember → Frostspire bootstrap with ticking-area readiness,
  integrity polling, persisted recovery, and retry backoff.
- Indefinite automatic first-player safe-dock arrival while the starter island
  is being prepared.
- Four visible oak trees, adjacent surface iron/coal prospects with deeper
  buffered seams, abundant stone, and a placed workstation/furnace support the
  command-free first-skiff route.
- Host-side resource-budget contract joins the authored starter structure,
  recipes, and Dockmaster material requirements.
- Deterministic rebuilding of corrected islands.
- Solid starter-island surface and safe dock.
- Guaranteed progression chests and persistent island encounters.
- Last-safe-dock player recovery and `/skyknights:recover`.
- Dockmaster self-healing after older reload failures.

### Persistence

| Document | Schema | Tracks                                                                                                                                                                    |
| -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World    | 5      | base/derived seed, profile, deterministic island layout, player-modified protection, generated islands, content versions, active job, shared Raider encounter, migrations |
| Player   | 3      | initialization, recovery, discoveries, safe dock, objectives, Skycutter unlock, owned ship                                                                                |
| Ship     | 3      | identity, owner, home dock, docked state, frame, named modules, combat counters                                                                                           |

Supported migrations cover world schemas 1–4, player schemas 1–2, and ship
schemas 1–2.

### Airships

Current implementation:

- Native entity-based three-dimensional flight.
- Two-seat starter skiff and four-seat Skycutter.
- Summon-only two-seat Aether Outrigger and four-seat Steampunk Blimp visual
  prototypes, kept outside owned-ship persistence and progression.
- A mount-scoped stable-camera assist selects the built-in third-person view when
  boarding either large prototype. Outrigger and Blimp seat radii are 12 and
  16 blocks respectively. The preset remains active for the ride; normal
  perspective selection is restored on dismount, and FOV is untouched.
  Throwable camera activation and clear calls retry with deduplicated warnings.
- The Outrigger's primary geometry is doubled from its original imported
  model, with the mast/sail moved aft and above the forward helm sightline.
- Owner pilot arbitration with passenger/gunner support.
- Persistent module blueprints and entity-load restoration.
- Starter-craft range boundary and long-range engine modules.
- Cargo ownership, hull integrity, damage feedback, repair, dock recall,
  destruction tracking, and one-Kit reconstruction.
- Dock-only, owner-only module swaps that preserve both modules on failure.
- Expanded-cargo downgrade protection for occupied extra slots.

Accepted planned direction:

- bounded wood-block construction around one Helm and Ship Core;
- deterministic canonical blueprints with block, mass, lift, engine, seat,
  hardpoint, and byte caps;
- downward engines for lift and aft-facing engines for propulsion;
- technology progression from Apprentice Raft through compact Aether craft,
  Airbag dirigibles, expedition craft, and masterwork craft;
- Dockmaster reference plans/kits/construction orders plus player-saved
  blueprints;
- exact docked block reconstruction and a performance-gated flight proxy; and
- explicit coexistence with legacy Skiff/Skycutter saves.

These planned capabilities are specified in
[`SKYCRAFT_TECHNOLOGY_ROADMAP.md`](SKYCRAFT_TECHNOLOGY_ROADMAP.md). They are
not implementation evidence.

### Combat refit

- Reusable Cannon Control registered as a stable custom item component.
- Charges consumed from ship cargo before player inventory.
- 64-block aimed ray, visible shot, sound, 24 direct damage, and one-second
  cooldown.
- Owner-aboard permission for passenger gunners.
- Persistent shots, hits, and Raider defeats.
- Shared Raider state prevents normal encounter duplication.
- Raider recovery, defeat reward, Dockmaster core conversion, and
  offense-versus-defense Utility choice.

## Verification snapshot

The current `0.3.10` combined working tree has passed:

```text
npm run verify
npm audit --audit-level=high
```

Results:

- non-mutating verification of all 63 generated structures: passed;
- formatting/lint: passed;
- TypeScript/stable bundle: passed;
- host tests: 287 passed across 48 files;
- BDS NBT fixture tests: passed;
- production `.mcaddon`: built;
- experimental profile: built;
- GameTest profile: built;
- npm vulnerabilities: 0;

The production `sky_knights.mcaddon` is 207,063 bytes with SHA-256
`0de7282608be6659381d0fd8a704447a6854d35a11336d5406bd9a3181038f5e`.
Both nested packs report `0.3.10`, and archive inspection confirms the prior
prototype assets plus all 28 run-3 ambient structures.

The latest external-server and void-template evidence remains the earlier
`0.3.6` gate; those commands were not rerun for `0.3.10`:

- opt-in BDS `1.26.34.3` smoke: passed — both packs loaded without
  content errors and the named skiff-seat test passed. This smoke does not
  exercise island variety or inspect the starter prospect in a real client;
- opt-in BDS void-source gate: passed — 17 chunks and 1,671,168 blocks were
  scanned through Y=-64..319 across a restart, all were air, and the frozen
  source retained its fixed seed, Survival/debug defaults, disabled
  experiments, and starter-dock spawn;
- packaged `.mctemplate`: built and structurally inspected with both stable
  packs bound at `0.3.6`; 139,426 bytes, SHA-256
  `a05a446df94776161dc9e1c4efb6bb2ea984b8bcd8773d1a6ec252b821326811`;
  clean-client import remains pending.

These checks prove repository consistency, not in-game behavior. They did not
catch either `0.3.5` playtest defect: the resource contract counted ore the
generator placed rather than ore a player can reach, and no check could observe
which world type a tester had opened. Both now have host-side or in-game
guards. The remaining Minecraft validation is explicitly tracked below.

## Open validation gates

| Gate                                                                 | Status               | Test source                                                                                                                         |
| -------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `0.3.1` Phase 3 fresh bootstrap/schema-4 migration and layout safety | Pending              | [`PHASE_3_STABILIZATION_TEST_PLAN.md`](PHASE_3_STABILIZATION_TEST_PLAN.md); visible-but-queued starter failure requires retest      |
| Phase 3 player-modified terrain protection                           | Pending              | Phase 3 stabilization plan, Session D                                                                                               |
| Phase 3 structure-only activation isolation                          | Pending              | Phase 3 stabilization plan, Session E                                                                                               |
| BDS `SimulatedPlayer` interaction/mounting smoke                     | Pending              | [`BDS_GAME_TEST_HARNESS.md`](BDS_GAME_TEST_HARNESS.md); current runner executes one component-only GameTest                         |
| `0.2.0` fresh Survival progression                                   | Pending              | [`DOCKYARD_REFIT_COMBAT_TEST_PLAN.md`](DOCKYARD_REFIT_COMBAT_TEST_PLAN.md)                                                          |
| `0.1.0` → `0.2.0` world migration                                    | Pending              | Dockyard test plan, Session A                                                                                                       |
| All refit effects and visuals                                        | Pending              | Dockyard test plan, Sessions D–E                                                                                                    |
| Cannon negative cases and Raider battle                              | Pending              | Dockyard test plan, Sessions F–G                                                                                                    |
| Core delivery and Shield Projector                                   | Pending              | Dockyard test plan, Session H                                                                                                       |
| Reload/recovery matrix                                               | Pending              | Dockyard test plan, Session I                                                                                                       |
| Two-player owner/gunner/refit behavior                               | Pending              | Dockyard test plan, Session J                                                                                                       |
| Controller and touch                                                 | Pending              | Dockyard test plan, Session K                                                                                                       |
| Clean-client `.mcaddon` import                                       | Pending              | [`HANDS_ON_TEST_PLAN.md`](HANDS_ON_TEST_PLAN.md)                                                                                    |
| World-template import                                                | Pending              | Hands-on plan, Session 11                                                                                                           |
| Opt-in custom dimension                                              | Pending/non-blocking | Hands-on plan, Session 10                                                                                                           |
| `0.3.3` starter resource visibility and Apprentice recovery          | Pending              | [`SKYCRAFT_HANDS_ON_TEST_PLAN.md`](SKYCRAFT_HANDS_ON_TEST_PLAN.md), Sessions A–D                                                    |
| `0.3.3` reference/personal-blueprint material accounting             | Pending              | Skycraft plan, Session E                                                                                                            |
| `0.3.4` void presentation and lazy generation                        | Passed 2026-07-27    | Archipelago plan, Sessions A and B                                                                                                  |
| `0.3.6` reachable starter resource route to the first ship           | Passed 2026-07-27    | Archipelago plan, Sessions A and A2                                                                                                 |
| `0.3.8` tier/altitude/burn/continent variety and performance         | Pending              | Archipelago plan, Sessions C-G; earlier `0.3.6` Session B passed                                                                    |
| `0.3.9` Outrigger scale and large-prototype camera behavior          | Pending              | [`AETHER_OUTRIGGER_TEST_PLAN.md`](AETHER_OUTRIGGER_TEST_PLAN.md) and [`STEAMPUNK_BLIMP_TEST_PLAN.md`](STEAMPUNK_BLIMP_TEST_PLAN.md) |
| `0.3.10` Fibonacci distribution, large usable tops, multipart seams, and performance | Pending | [`ARCHIPELAGO_HANDS_ON_TEST_PLAN.md`](ARCHIPELAGO_HANDS_ON_TEST_PLAN.md), Sessions B-G |
| Advanced proxy/cap/device profile                                    | Pending/gated        | Skycraft plan, Sessions F and J; normal activation remains disabled                                                                 |
| Skycraft damage/repair/combat and multiplayer permissions            | Pending              | Skycraft plan, Sessions G–H                                                                                                         |
| Skycraft progression and legacy coexistence                          | Pending              | Skycraft plan, Session I                                                                                                            |
| Player-built physical cargo                                          | Not activated        | Requires a future no-duplication transaction and restart/destruction matrix                                                         |

Use the ordered
[`CONSOLIDATED_HANDS_ON_ACCEPTANCE_PLAN.md`](CONSOLIDATED_HANDS_ON_ACCEPTANCE_PLAN.md)
to execute and report these gates against the current build. Historical
version labels identify the feature or migration under test; they do not
require reinstalling every old add-on version. Migration rows still require a
trustworthy backed-up old-world fixture.

## Known scope boundaries

- Player-built airframes use bounded exact dock blueprints and authored moving
  proxy entities. Arbitrary unbounded rigid blocks, block-perfect moving
  collision, and free walking on a moving deck remain outside the stable
  promise.
- A bounded procedural-template archipelago is implemented. Infinite streaming,
  algorithmic voxel bodies, true biome assignment, native feature-rule
  decoration, resources, and encounters remain outside this slice.
- Five seeded structures now have deterministic placement, discovery, and
  guaranteed gray-box caches. Their final custom creature/boss and reveal
  presentation remain incomplete.
- The stable sky-only template can now be generated locally as
  `dist/world-template/sky_knights_void_world.mctemplate`; generated world
  databases are intentionally not committed. Clean-client import and reload
  acceptance remain pending, and the custom dimension remains experimental.
- A normal Overworld continues generating vanilla land below the islands.
  Sky-only presentation requires a new void-world template; existing worlds
  are not destructively cleared or silently converted.
- Current art is functional gray-box/vanilla-derived presentation, not final
  release art.
- The BDS harness is a local one-test smoke, not dedicated-server longevity,
  Realms, Marketplace packaging, or redistribution acceptance.

## Next recommended work

1. Build and import the `0.3.10` `sky_knights_void_world.mctemplate`, confirm
   `/skyknights:debug` reports `v0.3.10` and `below=void`, and execute
   procedural archipelago Sessions B-G with explicit density, Fibonacci-ring
   naturalness, family arcs, useful landing/build area, Crag/Landmark seams,
   continent interruption, and weakest-device measurements. Earlier `0.3.6`
   Sessions A, A2, and B remain historical evidence but do not validate the
   run-3 planner.
2. Execute and record the Phase 3 stabilization plan on a fresh world and a
   backed-up schema-4 world copy.
3. Run the Skycraft BDS pack-load/reconstruction/restart matrix and add one
   bounded `SimulatedPlayer` mount/permission test without claiming forms,
   rendering, or client controls.
4. Execute Skycraft hands-on Sessions A–E before promoting the Apprentice
   architecture.
5. Measure the authored proxy at 24 blocks on keyboard, controller, touch,
   two-player, and the lowest target device.
6. Fix only reproducible transaction, reconstruction, permission, UX, or
   progression failures.
7. Run advanced references through Sessions F–J with the experimental tag and
   retain their caps as provisional.
8. Design physical cargo only after the explicit ownership-transfer,
   restart/destruction, and no-duplication contract is reviewable.
9. Complete navigation/shared-dock depth, legacy retrofit, custom creature
   content, final art, and accessibility after their preceding gates pass.

## Documentation map

| Document                                                                               | Purpose                                                              |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [`CHANGELOG.md`](../CHANGELOG.md)                                                      | Version-by-version implementation history                            |
| [`PROJECT_STATUS.md`](PROJECT_STATUS.md)                                               | Current authoritative implementation and remaining work              |
| [`CONSOLIDATED_HANDS_ON_ACCEPTANCE_PLAN.md`](CONSOLIDATED_HANDS_ON_ACCEPTANCE_PLAN.md) | Ordered checklist and reporting format for all open validation gates |
| [`VALIDATION_LOG.md`](VALIDATION_LOG.md)                                               | Automated and hands-on evidence ledger                               |
| [`DECISIONS.md`](DECISIONS.md)                                                         | Accepted architecture decisions                                      |
| [`MULTI_AGENT_WORKFLOW.md`](MULTI_AGENT_WORKFLOW.md)                                   | Vendor-neutral central/specialist/QA workflow                        |
| [`BDS_GAME_TEST_HARNESS.md`](BDS_GAME_TEST_HARNESS.md)                                 | Opt-in server smoke setup, ownership, evidence, and limits           |
| [`AETHER_OUTRIGGER_TEST_PLAN.md`](AETHER_OUTRIGGER_TEST_PLAN.md)                       | Outrigger rendering, seats, handling, reload, and acceptance gates   |
| [`STEAMPUNK_BLIMP_TEST_PLAN.md`](STEAMPUNK_BLIMP_TEST_PLAN.md)                         | Blimp art, animation, seats, flight, reload, and acceptance gates    |
| [`AI_HANDOFF.md`](AI_HANDOFF.md)                                                       | Current checkpoint, takeover commands, and recommended next slice    |
| [`SKYCRAFT_TECHNOLOGY_ROADMAP.md`](SKYCRAFT_TECHNOLOGY_ROADMAP.md)                     | Player-built airframes, lift/engine tech, blueprints, and gates      |
| [`SKYCRAFT_IMPLEMENTATION_STATUS.md`](SKYCRAFT_IMPLEMENTATION_STATUS.md)               | Exact integrated, gated, and pending Skycraft capability map         |
| [`SKYCRAFT_HANDS_ON_TEST_PLAN.md`](SKYCRAFT_HANDS_ON_TEST_PLAN.md)                     | Skycraft Minecraft, multiplayer, input, migration, and device plan   |
| [`PROCEDURAL_ARCHIPELAGO.md`](PROCEDURAL_ARCHIPELAGO.md)                               | Bounded clustered island-generation architecture                     |
| [`ARCHIPELAGO_HANDS_ON_TEST_PLAN.md`](ARCHIPELAGO_HANDS_ON_TEST_PLAN.md)               | Void-world, clustering, reload, safety, and performance plan         |
| [`BEDROCK_ADDON_ROADMAP.md`](../BEDROCK_ADDON_ROADMAP.md)                              | Product target and phased roadmap                                    |
| [`DEVELOPMENT_ENVIRONMENT.md`](DEVELOPMENT_ENVIRONMENT.md)                             | Tooling, deployment, audit, and debugging                            |
| [`DOCKYARD_REFIT_COMBAT_TEST_PLAN.md`](DOCKYARD_REFIT_COMBAT_TEST_PLAN.md)             | Current `0.2.0` acceptance plan                                      |
| [`PHASE_3_STABILIZATION_TEST_PLAN.md`](PHASE_3_STABILIZATION_TEST_PLAN.md)             | Schema-5, layout, activation, and migration acceptance               |
| [`CRYSTAL_TO_CUTTER_TEST_PLAN.md`](CRYSTAL_TO_CUTTER_TEST_PLAN.md)                     | Base Skycutter progression regression                                |
| [`PHASE_2_PLAYTEST.md`](PHASE_2_PLAYTEST.md)                                           | Short starter-island/skiff regression                                |
| [`HANDS_ON_TEST_PLAN.md`](HANDS_ON_TEST_PLAN.md)                                       | Broad platform, input, multiplayer, profile, and packaging matrix    |

## Tracker maintenance

For every future slice:

1. update `CHANGELOG.md` with user-visible changes;
2. update this capability/status matrix;
3. add or revise a focused hands-on test plan;
4. record automated commands and hands-on outcomes in `VALIDATION_LOG.md`;
5. update decisions when architecture or persistence contracts change;
6. update the roadmap only when milestone scope or status changes;
7. commit implementation and documentation together.
