# Project Status

> Last updated: 2026-07-26
>
> Current playtest version: `0.2.0`
>
> Stable API baseline: Minecraft Bedrock 1.26.30+, `@minecraft/server` 2.8.0,
> `@minecraft/server-ui` 2.1.0
>
> Current state: implemented, automatically verified, and locally deployed;
> `0.2.0` hands-on validation pending

This is the authoritative implementation tracker. The roadmap describes the
target product; this document records what the repository currently delivers.
Release history is in [`CHANGELOG.md`](../CHANGELOG.md), and test evidence is
in [`VALIDATION_LOG.md`](VALIDATION_LOG.md).

## Milestone status

| Roadmap milestone | Status | Evidence and remaining work |
| --- | --- | --- |
| Phase 0 — capability proofs | Substantially implemented | Stable packs, entity flight, authored structures, persistence, GameTest, world-template packager, and experimental dimension profile exist. Controller/touch, clean-client template import, and the complete experimental matrix remain manual gates. |
| Phase 1 — production scaffold | Implemented | Repeatable lint/build/test/deploy/package commands, startup registry validation, structured logging, diagnostics, CI, and fixed dynamic-property repositories are present. |
| Phase 2 — gray-box vertical loop | Implemented and hands-on exercised | Solid home island, Dockmaster, crafting, Ember expedition, starter skiff, rescue, persistence, and safe return were exercised during development. Full multiplayer/input matrix remains open. |
| Phase 3 — deterministic sky realm | Partially implemented | Three fixed authored islands use resumable placement and independent content versions. Seed/profile selection, four biome families, and hybrid procedural layout remain deferred. |
| Phase 4 — progression/combat/NPC depth | Partially implemented | Guaranteed Crystal/Froststeel progression, tutorial, Dockmaster, Frostspire Warden, and Ashwing Raider exist. Full tool ladder, four NPC roles, structure set, creature roster, and named weapons remain. |
| Phase 5 — ship builder depth | First substantial slice implemented | Skiff and Skycutter frames, four module slots, atomic refits, variants, seats, ownership, cargo, hull, cannon, shield, docking, recall, and reconstruction exist. `0.2.0` hands-on and device/multiplayer gates remain. |
| Phases 6–7 — content complete and hardening | Not started as milestones | Packaging infrastructure exists, but final art/content, balance, localization breadth, performance, device matrix, migrations from public builds, and release-candidate checks remain. |

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

| Content type | Implemented |
| --- | --- |
| Authored islands | Verdant starter island, Ember Outpost, Frostspire |
| Custom entities | Dockmaster, starter skiff, Skycutter, Ashwing Raider |
| Custom items | 18 |
| Custom recipes | 12 |
| Ship frames | Starter skiff, Skycutter |
| Skycutter slots | Hull, Engine, Cargo, Utility |
| Standard modules | Reinforced Hull, Aether Engine, Cargo Hold, Navigator Module |
| Advanced modules | Armored Hull, Frostfire Engine, Expanded Cargo Hold, Aether Cannon, Shield Projector |
| Encounters | Ember Guardian, Frostspire Warden, Ashwing Raider |
| GameTests | 4 registered in-engine tests |
| Host tests | 25 tests across 8 files |
| Developer commands | `debug`, `skiff`, `skycutter`, `island`, `raider`, `recover` |

## Systems implemented

### Build, packaging, and security

- Exact stable Minecraft module versions and fixed pack UUIDs.
- TypeScript type checking and esbuild bundling.
- Prettier-based linting and host-side Vitest suite.
- Stable `.mcaddon`, opt-in experimental `.mcpack`, opt-in GameTest `.mcpack`,
  and world-template packaging.
- Local one-shot or watched deployment to Minecraft Bedrock GDK folders.
- CI verification workflow.
- No current npm audit findings; only the exact pinned esbuild install script
  is approved.

### World generation and recovery

- Authored `.mcstructure` placement through a resumable generation queue.
- Per-island content versions and integrity checks.
- Deterministic rebuilding of corrected islands.
- Solid starter-island surface and safe dock.
- Guaranteed progression chests and persistent island encounters.
- Last-safe-dock player recovery and `/skyknights:recover`.
- Dockmaster self-healing after older reload failures.

### Persistence

| Document | Schema | Tracks |
| --- | --- | --- |
| World | 4 | seed, generated islands, content versions, active generation job, shared Raider encounter, migrations |
| Player | 3 | initialization, recovery, discoveries, safe dock, objectives, Skycutter unlock, owned ship |
| Ship | 3 | identity, owner, home dock, docked state, frame, named modules, combat counters |

Supported migrations cover world schemas 1–3, player schemas 1–2, and ship
schemas 1–2.

### Airships

- Native entity-based three-dimensional flight.
- Two-seat starter skiff and four-seat Skycutter.
- Owner pilot arbitration with passenger/gunner support.
- Persistent module blueprints and entity-load restoration.
- Starter-craft range boundary and long-range engine modules.
- Cargo ownership, hull integrity, damage feedback, repair, dock recall,
  destruction tracking, and one-Kit reconstruction.
- Dock-only, owner-only module swaps that preserve both modules on failure.
- Expanded-cargo downgrade protection for occupied extra slots.

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

The `0.2.0` source state has passed:

```text
npm run verify
npm audit --audit-level=high
node tools/project.mjs local-deploy --once
```

Results:

- formatting/lint: passed;
- TypeScript/stable bundle: passed;
- host tests: 25 passed;
- production `.mcaddon`: built;
- experimental profile: built;
- GameTest profile: built;
- npm vulnerabilities: 0;
- local Behavior and Resource Pack deployment: passed.

These checks prove repository consistency, not in-game behavior. The remaining
Minecraft validation is explicitly tracked below.

## Open validation gates

| Gate | Status | Test source |
| --- | --- | --- |
| `0.2.0` fresh Survival progression | Pending | [`DOCKYARD_REFIT_COMBAT_TEST_PLAN.md`](DOCKYARD_REFIT_COMBAT_TEST_PLAN.md) |
| `0.1.0` → `0.2.0` world migration | Pending | Dockyard test plan, Session A |
| All refit effects and visuals | Pending | Dockyard test plan, Sessions D–E |
| Cannon negative cases and Raider battle | Pending | Dockyard test plan, Sessions F–G |
| Core delivery and Shield Projector | Pending | Dockyard test plan, Session H |
| Reload/recovery matrix | Pending | Dockyard test plan, Session I |
| Two-player owner/gunner/refit behavior | Pending | Dockyard test plan, Session J |
| Controller and touch | Pending | Dockyard test plan, Session K |
| Clean-client `.mcaddon` import | Pending | [`HANDS_ON_TEST_PLAN.md`](HANDS_ON_TEST_PLAN.md) |
| World-template import | Pending | Hands-on plan, Session 11 |
| Experimental custom dimension | Pending/non-blocking | Hands-on plan, Session 10 |

## Known scope boundaries

- Ships are configured moving entities, not arbitrary player-built rigid block
  structures.
- Island placement is authored-first; infinite/procedural generation is not
  implemented.
- Stable release architecture remains a supplied world/template; the custom
  dimension is experimental.
- Current art is functional gray-box/vanilla-derived presentation, not final
  release art.
- Realms, dedicated-server longevity, Marketplace packaging, and redistribution
  licensing are not yet accepted.

## Next recommended work

1. Execute and record the complete `0.2.0` hands-on test plan.
2. Fix only reproducible playtest defects before adding another feature slice.
3. Run the two-player owner/gunner encounter and controller checks.
4. Import the `.mcaddon` and world template on a clean client.
5. After the validation gate passes, choose between:
   - a combat/balance polish slice; or
   - the first new biome/structure/content-family slice.

## Documentation map

| Document | Purpose |
| --- | --- |
| [`CHANGELOG.md`](../CHANGELOG.md) | Version-by-version implementation history |
| [`PROJECT_STATUS.md`](PROJECT_STATUS.md) | Current authoritative implementation and remaining work |
| [`VALIDATION_LOG.md`](VALIDATION_LOG.md) | Automated and hands-on evidence ledger |
| [`DECISIONS.md`](DECISIONS.md) | Accepted architecture decisions |
| [`BEDROCK_ADDON_ROADMAP.md`](../BEDROCK_ADDON_ROADMAP.md) | Product target and phased roadmap |
| [`DEVELOPMENT_ENVIRONMENT.md`](DEVELOPMENT_ENVIRONMENT.md) | Tooling, deployment, audit, and debugging |
| [`DOCKYARD_REFIT_COMBAT_TEST_PLAN.md`](DOCKYARD_REFIT_COMBAT_TEST_PLAN.md) | Current `0.2.0` acceptance plan |
| [`CRYSTAL_TO_CUTTER_TEST_PLAN.md`](CRYSTAL_TO_CUTTER_TEST_PLAN.md) | Base Skycutter progression regression |
| [`PHASE_2_PLAYTEST.md`](PHASE_2_PLAYTEST.md) | Short starter-island/skiff regression |
| [`HANDS_ON_TEST_PLAN.md`](HANDS_ON_TEST_PLAN.md) | Broad platform, input, multiplayer, profile, and packaging matrix |

## Tracker maintenance

For every future slice:

1. update `CHANGELOG.md` with user-visible changes;
2. update this capability/status matrix;
3. add or revise a focused hands-on test plan;
4. record automated commands and hands-on outcomes in `VALIDATION_LOG.md`;
5. update decisions when architecture or persistence contracts change;
6. update the roadmap only when milestone scope or status changes;
7. commit implementation and documentation together.
