# Project Status

> Last updated: 2026-07-27
>
> Current playtest version: `0.3.3`
>
> Stable API baseline: Minecraft Bedrock 1.26.30+, `@minecraft/server` 2.8.0,
> `@minecraft/server-ui` 2.1.0
>
> Current state: the `0.2.0` legacy ship/combat loop, `0.3.1` deterministic
> realm stabilization, and an integrated `0.3.3` bounded player-built
> Skycraft prototype. The repository gate and independent QA are green;
> Skycraft-specific BDS, Minecraft, multiplayer, input, migration, and device
> gates remain.

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
| Phase 3 — deterministic sky realm           | Runtime/content integrated; hands-on pending      | Schema 5, deterministic seed/layout, three pinned and five seeded islands, persistent placements, clear-lane checks, resumable placement, retry/backoff, safe arrival, guaranteed caches, discovery, and progression closure exist. Final custom creatures, reveal UX, and client migration evidence remain.                                                          |
| Phase 4 — progression/combat/NPC depth      | Partially implemented                            | Guaranteed Crystal/Froststeel progression, tutorial, Dockmaster, Frostspire Warden, and Ashwing Raider exist. Full tool ladder, four NPC roles, structure set, creature roster, and named weapons remain.                                                                                                                                                                                                     |
| Phase 5 — player-built skycraft             | Integrated prototype; external gates pending     | Helm-connected custom airframes, canonical blueprints, mass/lift technology, directional engines, authored proxies, atomic reconstruction/recovery, five certifications, 18 components, eight references, personal saves, roles, damage/repair, and combat are integrated. Physical cargo, navigation, shared-dock depth, retrofit, final content/art, and acceptance gates remain.             |
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
| Authored islands   | 8 packaged and gameplay-ready; five later islands use guaranteed gray-box caches      |
| Custom entities    | Dockmaster, starter skiff, Skycutter, Ashwing Raider, Skycraft flight proxy            |
| Custom items       | 20 legacy/progression items plus 18 placeable Skycraft block-items                     |
| Custom recipes     | 30                                                                                    |
| Ship frames        | Starter skiff, Skycutter, eight editable Skycraft reference fixtures                  |
| Skycutter slots    | Hull, Engine, Cargo, Utility                                                         |
| Standard modules   | Reinforced Hull, Aether Engine, Cargo Hold, Navigator Module                         |
| Advanced modules   | Armored Hull, Frostfire Engine, Expanded Cargo Hold, Aether Cannon, Shield Projector |
| Encounters         | Ember Guardian, Frostspire Warden, Ashwing Raider                                    |
| GameTests          | 4 registered; 1 executed by the opt-in BDS smoke harness                             |
| Host tests         | 209 passed across 35 files at the `0.3.3` corrective repository gate                 |
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
- Island activation remains explicit; all eight current structures are
  `ready`, while final custom creatures/bosses stay marked planned in the
  content matrix rather than being implied by terrain or cache activation.
- Per-island content versions and integrity checks.
- Automatic starter → Ember → Frostspire bootstrap with ticking-area readiness,
  integrity polling, persisted recovery, and retry backoff.
- Indefinite automatic first-player safe-dock arrival while the starter island
  is being prepared.
- Two visible oak trees, adjacent surface iron/coal prospects with deeper
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
npm run test:bds:smoke
```

Results:

- non-mutating generated-structure verification: passed;
- formatting/lint: passed;
- TypeScript/stable bundle: passed;
- host tests: 209 passed across 35 files;
- BDS NBT fixture tests: passed;
- production `.mcaddon`: built;
- experimental profile: built;
- GameTest profile: built;
- npm vulnerabilities: 0;
- opt-in BDS `1.26.34.3` working-tree smoke: passed — both packs loaded without
  content errors and the named skiff-seat test passed. This smoke does not
  inspect the starter prospect in a real client.

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
| `0.3.3` starter resource visibility and Apprentice recovery          | Pending              | [`SKYCRAFT_HANDS_ON_TEST_PLAN.md`](SKYCRAFT_HANDS_ON_TEST_PLAN.md), Sessions A–D                                               |
| `0.3.3` reference/personal-blueprint material accounting             | Pending              | Skycraft plan, Session E                                                                                                       |
| Advanced proxy/cap/device profile                                    | Pending/gated        | Skycraft plan, Sessions F and J; normal activation remains disabled                                                            |
| Skycraft damage/repair/combat and multiplayer permissions            | Pending              | Skycraft plan, Sessions G–H                                                                                                    |
| Skycraft progression and legacy coexistence                          | Pending              | Skycraft plan, Session I                                                                                                       |
| Player-built physical cargo                                          | Not activated        | Requires a future no-duplication transaction and restart/destruction matrix                                                    |

## Known scope boundaries

- Player-built airframes use bounded exact dock blueprints and authored moving
  proxy entities. Arbitrary unbounded rigid blocks, block-perfect moving
  collision, and free walking on a moving deck remain outside the stable
  promise.
- Island placement is authored-first; infinite/procedural generation is not
  implemented.
- Five seeded structures now have deterministic placement, discovery, and
  guaranteed gray-box caches. Their final custom creature/boss and reveal
  presentation remain incomplete.
- The intended stable sky-only distribution remains a void-world template, but
  no source world or `.mctemplate` artifact is supplied yet; the custom
  dimension is experimental.
- A normal Overworld continues generating vanilla land below the islands.
  Sky-only presentation requires a new void-world template; existing worlds
  are not destructively cleared or silently converted.
- Current art is functional gray-box/vanilla-derived presentation, not final
  release art.
- The BDS harness is a local one-test smoke, not dedicated-server longevity,
  Realms, Marketplace packaging, or redistribution acceptance.

## Next recommended work

1. Execute and record the Phase 3 stabilization plan on a fresh world and a
   backed-up schema-4 world copy.
2. Run the Skycraft BDS pack-load/reconstruction/restart matrix and add one
   bounded `SimulatedPlayer` mount/permission test without claiming forms,
   rendering, or client controls.
3. Execute Skycraft hands-on Sessions A–E before promoting the Apprentice
   architecture.
4. Measure the authored proxy at 24 blocks on keyboard, controller, touch,
   two-player, and the lowest target device.
5. Fix only reproducible transaction, reconstruction, permission, UX, or
   progression failures.
6. Run advanced references through Sessions F–J with the experimental tag and
   retain their caps as provisional.
7. Design physical cargo only after the explicit ownership-transfer,
   restart/destruction, and no-duplication contract is reviewable.
8. Complete navigation/shared-dock depth, legacy retrofit, custom creature
   content, final art, and accessibility after their preceding gates pass.

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
| [`SKYCRAFT_IMPLEMENTATION_STATUS.md`](SKYCRAFT_IMPLEMENTATION_STATUS.md)   | Exact integrated, gated, and pending Skycraft capability map      |
| [`SKYCRAFT_HANDS_ON_TEST_PLAN.md`](SKYCRAFT_HANDS_ON_TEST_PLAN.md)         | Skycraft Minecraft, multiplayer, input, migration, and device plan |
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
