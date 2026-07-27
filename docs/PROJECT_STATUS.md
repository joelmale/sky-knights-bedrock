# Project Status

> Last updated: 2026-07-26
>
> Current playtest version: `0.3.1`
>
> Stable API baseline: Minecraft Bedrock 1.26.30+, `@minecraft/server` 2.8.0,
> `@minecraft/server-ui` 2.1.0
>
> Current state: `0.2.0` gameplay plus the `0.3.1` Phase 3 deterministic-realm
> bootstrap, integrity, starter-resource correction, and first guarded
> BDS/GameTest smoke harness implemented; Phase 3 client hands-on validation
> pending. Bounded player-built wooden skycraft is the accepted next major
> architecture direction but is not implemented.

This is the authoritative implementation tracker. The roadmap describes the
target product; this document records what the repository currently delivers.
Release history is in [`CHANGELOG.md`](../CHANGELOG.md), and test evidence is
in [`VALIDATION_LOG.md`](VALIDATION_LOG.md).

## Milestone status

| Roadmap milestone                           | Status                                           | Evidence and remaining work                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 — capability proofs                 | Substantially implemented                        | Stable packs, entity flight, authored structures, persistence, GameTest, a version-gated BDS smoke runner, world-template packager, and experimental dimension profile exist. SimulatedPlayer depth, controller/touch, clean-client template import, and the complete experimental matrix remain open.                                                                                                        |
| Phase 1 — production scaffold               | Implemented                                      | Repeatable lint/build/test/deploy/package commands, startup registry validation, structured logging, diagnostics, CI, and fixed dynamic-property repositories are present.                                                                                                                                                                                                                                    |
| Phase 2 — gray-box vertical loop            | Implemented and hands-on exercised               | Solid home island, Dockmaster, crafting, Ember expedition, starter skiff, rescue, persistence, and safe return were exercised during development. Full multiplayer/input matrix remains open.                                                                                                                                                                                                                 |
| Phase 3 — deterministic sky realm           | Bootstrap recovery implemented; hands-on pending | Schema 5, deterministic default seed, world profile/seed derivation, four-family registry, three pinned islands, five seeded structure-only islands, persistent placements, clear-lane checks, origin-aware resumable placement, automatic retry/backoff, safe initial arrival, activation gates, and progression closure exist. New-island creatures, rewards, reveal UI, and gameplay activation remain.    |
| Phase 4 — progression/combat/NPC depth      | Partially implemented                            | Guaranteed Crystal/Froststeel progression, tutorial, Dockmaster, Frostspire Warden, and Ashwing Raider exist. Full tool ladder, four NPC roles, structure set, creature roster, and named weapons remain.                                                                                                                                                                                                     |
| Phase 5 — player-built skycraft             | Entity prototype built; custom airframes planned | Skiff and Skycutter frames, four module slots, atomic refits, seats, ownership, cargo, hull, cannon, shield, docking, recall, and reconstruction exist. The accepted future direction is a Helm-centered connected wood blueprint with mass/lift technology, directional engines, reference blueprints, compact and dirigible branches, and atomic dock reconstruction. No custom-airframe runtime ships yet. |
| Phases 6–7 — content complete and hardening | Not started as milestones                        | Packaging infrastructure exists, but final art/content, balance, localization breadth, performance, device matrix, migrations from public builds, and release-candidate checks remain.                                                                                                                                                                                                                        |

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

| Content type       | Implemented                                                                          |
| ------------------ | ------------------------------------------------------------------------------------ |
| Authored islands   | 8 packaged: 3 gameplay-ready and 5 structure-only                                    |
| Custom entities    | Dockmaster, starter skiff, Skycutter, Ashwing Raider                                 |
| Custom items       | 18                                                                                   |
| Custom recipes     | 12                                                                                   |
| Ship frames        | Starter skiff, Skycutter                                                             |
| Skycutter slots    | Hull, Engine, Cargo, Utility                                                         |
| Standard modules   | Reinforced Hull, Aether Engine, Cargo Hold, Navigator Module                         |
| Advanced modules   | Armored Hull, Frostfire Engine, Expanded Cargo Hold, Aether Cannon, Shield Projector |
| Encounters         | Ember Guardian, Frostspire Warden, Ashwing Raider                                    |
| GameTests          | 4 registered; 1 executed by the opt-in BDS smoke harness                             |
| Host tests         | 162 passed across 20 files                                                           |
| Developer commands | `debug`, `skiff`, `skycutter`, `island`, `raider`, `recover`, test bench, objective  |

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
- Local one-shot or watched deployment to Minecraft Bedrock GDK folders.
- CI verification workflow.
- No current npm audit findings; only the exact pinned esbuild install script
  is approved.

### World generation and recovery

- Authored `.mcstructure` placement through a resumable generation queue.
- Four-family deterministic registry with three permanently pinned islands and
  five seeded island placements.
- Persisted world profile, layout seed, layout version, origins, reserved
  bounds, and sticky player-modified protection.
- New-island activation fails closed at `structure_only`; incomplete content
  cannot enter the generation queue.
- Per-island content versions and integrity checks.
- Automatic starter → Ember → Frostspire bootstrap with ticking-area readiness,
  integrity polling, persisted recovery, and retry backoff.
- Indefinite automatic first-player safe-dock arrival while the starter island
  is being prepared.
- Two visible oak trees, exposed buffered coal/iron seams, abundant stone, and
  placed workstation/furnace support the command-free first-skiff route.
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

The current development source has passed:

```text
npm run verify
npm audit --audit-level=high
node tools/project.mjs local-deploy --once
```

Results:

- non-mutating generated-structure verification: passed;
- formatting/lint: passed;
- TypeScript/stable bundle: passed;
- host tests: 153 passed across 19 files;
- BDS NBT fixture tests: passed;
- production `.mcaddon`: built;
- experimental profile: built;
- GameTest profile: built;
- npm vulnerabilities: 0;
- local Behavior and Resource Pack deployment: passed;
- opt-in BDS `1.26.34.3` clean-commit smoke: passed — both packs loaded without
  content errors, the named skiff-seat test emitted the exact `onTestPassed`
  marker, `gitDirty: false` was recorded, server properties were restored, and
  no runner process or temporary safety file remained.

These checks prove repository consistency, not in-game behavior. The remaining
Minecraft validation is explicitly tracked below.

## Open validation gates

| Gate                                                                 | Status               | Test source                                                                                                                    |
| -------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `0.3.1` Phase 3 fresh bootstrap/schema-4 migration and layout safety | Pending              | [`PHASE_3_STABILIZATION_TEST_PLAN.md`](PHASE_3_STABILIZATION_TEST_PLAN.md); visible-but-queued starter failure requires retest |
| Phase 3 player-modified terrain protection                           | Pending              | Phase 3 stabilization plan, Session D                                                                                          |
| Phase 3 structure-only activation isolation                          | Pending              | Phase 3 stabilization plan, Session E                                                                                          |
| BDS `SimulatedPlayer` interaction/mounting smoke                     | Pending              | [`BDS_GAME_TEST_HARNESS.md`](BDS_GAME_TEST_HARNESS.md); current runner executes one component-only GameTest                    |
| `0.2.0` fresh Survival progression                                   | Pending              | [`DOCKYARD_REFIT_COMBAT_TEST_PLAN.md`](DOCKYARD_REFIT_COMBAT_TEST_PLAN.md)                                                     |
| `0.1.0` → `0.2.0` world migration                                    | Pending              | Dockyard test plan, Session A                                                                                                  |
| All refit effects and visuals                                        | Pending              | Dockyard test plan, Sessions D–E                                                                                               |
| Cannon negative cases and Raider battle                              | Pending              | Dockyard test plan, Sessions F–G                                                                                               |
| Core delivery and Shield Projector                                   | Pending              | Dockyard test plan, Session H                                                                                                  |
| Reload/recovery matrix                                               | Pending              | Dockyard test plan, Session I                                                                                                  |
| Two-player owner/gunner/refit behavior                               | Pending              | Dockyard test plan, Session J                                                                                                  |
| Controller and touch                                                 | Pending              | Dockyard test plan, Session K                                                                                                  |
| Clean-client `.mcaddon` import                                       | Pending              | [`HANDS_ON_TEST_PLAN.md`](HANDS_ON_TEST_PLAN.md)                                                                               |
| World-template import                                                | Pending              | Hands-on plan, Session 11                                                                                                      |
| Experimental custom dimension                                        | Pending/non-blocking | Hands-on plan, Session 10                                                                                                      |

## Known scope boundaries

- Shipping ships are configured moving entities. Future custom airframes use
  bounded player-built dock blueprints and an entity flight representation;
  arbitrary unbounded rigid blocks, block-perfect moving collision, and free
  walking on a moving deck remain outside the stable promise.
- Island placement is authored-first; infinite/procedural generation is not
  implemented.
- Five additional structures have deterministic placements but intentionally
  have no player-facing reveal or activation until their content dependencies
  ship.
- Stable release architecture remains a supplied world/template; the custom
  dimension is experimental.
- Current art is functional gray-box/vanilla-derived presentation, not final
  release art.
- The BDS harness is a local one-test smoke, not dedicated-server longevity,
  Realms, Marketplace packaging, or redistribution acceptance.

## Next recommended work

1. Execute and record the Phase 3 stabilization plan on a fresh world and a
   backed-up schema-4 world copy.
2. Add one bounded BDS `SimulatedPlayer` interaction/mounting test without
   claiming client UI or control coverage.
3. Complete the outstanding `0.2.0` combat/refit hands-on rows.
4. Fix only reproducible playtest defects before changing the ship foundation.
5. Implement the bounded `0.4.0` player-built raft feasibility spike: scan,
   canonical blueprint, mass/lift validation, directional engines, launch,
   flight proxy, exact docking, restart recovery, and reference fixtures.
6. Stop and choose the documented visual fallback if the target-device,
   multiplayer, or reconstruction gates fail.
7. Build the Apprentice Raft MVP before activating new content whose
   progression assumes custom skycraft.

## Documentation map

| Document                                                                   | Purpose                                                           |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`CHANGELOG.md`](../CHANGELOG.md)                                          | Version-by-version implementation history                         |
| [`PROJECT_STATUS.md`](PROJECT_STATUS.md)                                   | Current authoritative implementation and remaining work           |
| [`VALIDATION_LOG.md`](VALIDATION_LOG.md)                                   | Automated and hands-on evidence ledger                            |
| [`DECISIONS.md`](DECISIONS.md)                                             | Accepted architecture decisions                                   |
| [`MULTI_AGENT_WORKFLOW.md`](MULTI_AGENT_WORKFLOW.md)                       | Vendor-neutral central/specialist/QA workflow                     |
| [`BDS_GAME_TEST_HARNESS.md`](BDS_GAME_TEST_HARNESS.md)                     | Opt-in server smoke setup, ownership, evidence, and limits        |
| [`SKYCRAFT_TECHNOLOGY_ROADMAP.md`](SKYCRAFT_TECHNOLOGY_ROADMAP.md)         | Player-built airframes, lift/engine tech, blueprints, and gates   |
| [`BEDROCK_ADDON_ROADMAP.md`](../BEDROCK_ADDON_ROADMAP.md)                  | Product target and phased roadmap                                 |
| [`DEVELOPMENT_ENVIRONMENT.md`](DEVELOPMENT_ENVIRONMENT.md)                 | Tooling, deployment, audit, and debugging                         |
| [`DOCKYARD_REFIT_COMBAT_TEST_PLAN.md`](DOCKYARD_REFIT_COMBAT_TEST_PLAN.md) | Current `0.2.0` acceptance plan                                   |
| [`PHASE_3_STABILIZATION_TEST_PLAN.md`](PHASE_3_STABILIZATION_TEST_PLAN.md) | Schema-5, layout, activation, and migration acceptance            |
| [`CRYSTAL_TO_CUTTER_TEST_PLAN.md`](CRYSTAL_TO_CUTTER_TEST_PLAN.md)         | Base Skycutter progression regression                             |
| [`PHASE_2_PLAYTEST.md`](PHASE_2_PLAYTEST.md)                               | Short starter-island/skiff regression                             |
| [`HANDS_ON_TEST_PLAN.md`](HANDS_ON_TEST_PLAN.md)                           | Broad platform, input, multiplayer, profile, and packaging matrix |

## Tracker maintenance

For every future slice:

1. update `CHANGELOG.md` with user-visible changes;
2. update this capability/status matrix;
3. add or revise a focused hands-on test plan;
4. record automated commands and hands-on outcomes in `VALIDATION_LOG.md`;
5. update decisions when architecture or persistence contracts change;
6. update the roadmap only when milestone scope or status changes;
7. commit implementation and documentation together.
