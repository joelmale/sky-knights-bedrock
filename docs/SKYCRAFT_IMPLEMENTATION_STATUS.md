# Skycraft Implementation Status

> Central integration tracker for
> [`SKYCRAFT_TECHNOLOGY_ROADMAP.md`](SKYCRAFT_TECHNOLOGY_ROADMAP.md).
>
> Playtest build: `0.3.4`
>
> Branch: `codex/skycraft-program`
>
> Status: integrated prototype; repository gate and independent QA passed.
> Skycraft-specific BDS, Minecraft, multiplayer, input, migration, and device
> acceptance remain pending.

## Architecture delivered

Player-built Skycraft is a separate system beside the legacy Skiff and
Skycutter. It does not reinterpret legacy `ShipState` schema 3 or silently
convert an existing ship.

```text
docked approved blocks
  -> six-neighbor bounded deterministic scan
  -> canonical versioned blueprint
  -> integer engineering report
  -> persisted launch transaction
  -> authored modular flight proxy
  -> persisted docking transaction
  -> exact approved-block reconstruction
```

The exact docked blueprint is authoritative for block geometry and approved
permutation states. The persistent entity is authoritative for movement,
riders, health, and flight location while the record is `in_flight`.

The prototype intentionally selects the roadmap's authored modular proxy
fallback. It classifies reference designs and custom builds into recognizable
raft, cutter, dirigible, disc, combat, expedition, and masterwork visuals. It
does not promise block-perfect moving collision or free walking on a rotating
deck.

## Activation policy

Implementation is separate from promotion:

- Apprentice construction is available for normal hands-on playtesting.
- Advanced code, blocks, recipes, reference fixtures, and provisional caps are
  packaged so they can be tested.
- Advanced player activation requires the explicit cheats-enabled tag
  `skyknights.skycraft_experimental`.
- That tag is a test bypass, not progression or performance acceptance.
- Physical cargo remains disabled even under the test tag.
- No cap above Apprentice becomes a normal shipping cap until BDS,
  multiplayer, serialized-byte, lowest-device, and four-craft measurements are
  recorded.

## Implemented contracts

| Area                       | Current implementation                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Berths                     | Five fixed, bounded dock pads; obstruction-safe preparation; one certification class per pad                                           |
| Scanner                    | Six-direction connectivity, stable sorted traversal, allow/forbid lists, berth and block caps, approved permutation states             |
| Blueprint                  | Strict schema-1 parser/migration, canonical byte-stable ordering, exact Helm/Core/component alignment, bounded byte measurement        |
| Engineering                | Fixed-point mass, 115% lift factor, crew/cargo reserve, directional engines, thrust/braking/control, caps, handling, hull, seats       |
| Persistence                | Sorted 128-airship index, bounded per-airship chunks, strict records, deterministic IDs, separate legacy namespace                     |
| Launch/dock                | Persist-before-mutate transaction ordering, exact preflight, clear/spawn/configure, reconstruct/verify/remove, fail-closed obstruction |
| Recovery                   | Validating, launching, docking, missing-flight, partial-block, dual-authority, and ambiguous obstruction handling                      |
| Ownership                  | Owner, builder, pilot, navigator, gunner, mechanic, passenger checks and certified-seat enforcement                                    |
| References                 | Minnow, Dart, Cargo Punt, Cloudwhale, Aether Disc, Frostwing, Surveyor, and Grand Cruiser exact dock fixtures                          |
| Personal blueprints        | Owner-scoped bounded library, strict records, optimistic revision, fresh-ID materialization, inventory-consuming rollback-safe order   |
| Damage/repair              | Persisted hull/subsystem bill, Shield reduction, destruction recovery, launch lock while damaged, atomic Repair Kit use                |
| Combat                     | Cannon Hardpoint check, owner/gunner authorization, carried Aether Charge consumption, existing Raider targeting                       |
| Technology/content         | Five certifications, two specialization branches, all 18 components/recipes, guaranteed caches through Aether Sanctum                  |
| Starter closure            | Authored starter resources and wrapper recipes support an Apprentice raft without an additional iron gate                              |
| Diagnostics/test materials | Helm report, exact refusal messages, Dockmaster plans/orders, and developer test-bench component stock                                 |

## Deliberately gated or incomplete

| Roadmap promise                    | Current boundary                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Bounded voxel proxy comparison     | Authored fallback implemented; voxel renderer and measured comparison not implemented                                           |
| Physical cargo                     | Engineering reserve only; runtime rejects any authority other than `disabled` until a no-duplication transfer exists            |
| Emergency descent                  | Deterministic rule model exists; no accepted runtime movement behavior yet                                                      |
| Subsystem flight penalties         | Damage and disabled-system bill persist; proxy movement penalties need real-client design and acceptance                        |
| Shared/guild dock network          | Fixed world-shared pads exist; multiple simultaneous guild berths, claims, and discovery UX are not implemented                 |
| Navigation utilities               | Roles and module foundations exist; destination-selection UI and route-finder behavior remain future runtime work               |
| Legacy retrofit                    | Capability coexistence is preserved; no owner-approved conversion is offered before migration and cargo tests                   |
| Complete custom creature roster    | New island structures and guaranteed caches are active; custom Goblin/Yeti/Demon/Hedgehog and final bosses remain planned       |
| Cosmetic mastery/final art         | Gray-box/vanilla-derived materials and authored proxy variants only                                                             |
| Accessibility/localization breadth | English strings and basic forms exist; final localization, narration, controller/touch, and color-independent review is pending |

These rows are not silently claimed by the existence of pure rule code or
packaged prototype assets.

## Slice traceability

| Roadmap slice          | Integrated foundation                                                                                                         | Gate still required                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `0.4.0` feasibility    | Scanner, blueprint, engineering, Apprentice berth, Minnow, authored proxy, launch/dock/recovery                               | Clean BDS reconstruction/restarts plus host, keyboard, controller, touch, two-player, and device data |
| `0.4.1` Apprentice     | Recipes/resources, inspection, two-seat proxy, damage/repair, plan/order, personal library/materialization, route foundations | Fresh Survival first-flight, two-player, save/reload, old-world migration                             |
| `0.5.0` Ember          | Ember certification, Aether propulsion, rudder, crew roles, Dart/Punt, abstract cargo reserve, legacy coexistence             | Physical cargo transaction and explicit retrofit                                                      |
| `0.6.0` specialization | Airbag/propeller and Lift Cell/Frostfire branches, Cloudwhale/Disc/Frostwing, damage model                                    | Proxy/device profile, emergency descent, subsystem movement effects, physical cargo                   |
| `0.7.0` Expedition     | Relic milestone, Surveyor, expanded crew, repair and combat hardpoints, fixed shared pads                                     | Shared-dock network, navigation runtime, four-player and 160-block profile                            |
| `0.8.0+` Masterwork    | Aether Core milestone, Grand Cruiser, 240-block pure/reference fixture                                                        | Lowest-device cap, cosmetic mastery, final content, accessibility, migration, release matrix          |

The later slice foundations are intentionally testable before their activation
gates are passed. They are not feature-complete releases.

## Persistence and recovery invariants

Skycraft uses separate namespaced dynamic properties:

- one small sorted fleet index;
- one bounded chunked document per immutable airship ID;
- one bounded owner-scoped personal-blueprint index and record set;
- one bounded world milestone document; and
- one airship-ID reference on each flight entity.

Unknown schemas, corrupt indices, corrupt records, oversized blueprints, stale
revisions, unauthorized actors, and ambiguous recovery states fail closed.
Every destructive launch/dock stage persists first. Cargo activation is refused
rather than approximated.

## Reference-fleet engineering status

Every reference layout is materialized through the production scanner and
engineering evaluator in host tests. References use the same placed component
IDs, mass values, certification caps, directional-engine rules, material
accounting, registration, damage, and reconstruction contracts as a custom
build.

The current flat connected teaching decks are functional dock fixtures. The
authored proxy provides the recognizable in-flight class silhouette. Neither is
final art.

## Evidence ledger

| Checkpoint                                    | Automated evidence                                                                                                  | External evidence                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Pre-Skycraft checkpoint `53b38e9`             | `npm run verify`: 162 tests across 20 files; audit zero; independent QA GO                                          | Test-bench hands-on cases pending                                          |
| Integrated Skycraft `0.3.2` repository gate   | `npm run verify`: 207 tests/35 files, structures, TypeScript, NBT, production `.mcaddon`, both profiles; audit zero | Not external evidence                                                      |
| Starter visibility `0.3.3` corrective gate    | `npm run verify`: 209 tests/35 files; deterministic starter structure; audit zero; BDS pack-load smoke passed       | Surface readability and void-template presentation still require Minecraft |
| Integrated Skycraft BDS pack-load smoke       | BDS `1.26.34.3` loaded the integrated packs without content errors and passed the existing named seat test          | Partial only; no Skycraft reconstruction, interaction, or restart GameTest |
| Independent integrated QA                     | GO after owner-action, component-tier, pre-mount role/seat-cap, active-craft-cap, parser, and repository hardening  | Not applicable                                                             |
| `0.4.0` BDS/real-client feasibility           | Pending                                                                                                             | Required before Apprentice architecture promotion                          |
| Advanced certification/device and multiplayer | Pure/reference fixtures only                                                                                        | Pending; normal activation remains gated                                   |
| Complete feature definition                   | Not claimed                                                                                                         | Requires every roadmap definition-of-complete row and focused test plan    |

## Validation documents

- [`SKYCRAFT_HANDS_ON_TEST_PLAN.md`](SKYCRAFT_HANDS_ON_TEST_PLAN.md) is the
  executable Minecraft, multiplayer, input, migration, and device matrix.
- [`BDS_GAME_TEST_HARNESS.md`](BDS_GAME_TEST_HARNESS.md) defines the current
  dedicated-server harness and its evidence limits.
- [`VALIDATION_LOG.md`](VALIDATION_LOG.md) records only checks that actually
  ran.

No automated result proves exact proxy readability, camera/collision feel,
controller/touch usability, network reconnect, host migration, clean-client
import, or target-device performance.
