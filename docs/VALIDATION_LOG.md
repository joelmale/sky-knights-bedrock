# Validation Log

This ledger records what was actually checked. Planned tests belong in the
focused test plans; only completed evidence belongs here.

Status meanings:

- **Passed** — the stated check ran and met its expectation.
- **Partial** — useful behavior was exercised, but the complete matrix was not.
- **Pending** — implemented but not yet tested through the stated gate.
- **Non-blocking experimental** — failure does not block the stable strategy.

## Evidence summary

| Date       | Build/state                                                | Validation                                                                      | Result                                                                                                                                                                                                                      |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-25 | Scaffold (`07ecfe2`)                                       | Local toolchain, stable build scaffold, fixed manifests, CI setup               | Passed                                                                                                                                                                                                                      |
| 2026-07-26 | Dependency/tooling cleanup                                 | `npm ci`, deprecated transitive dependency removal, audit remediation           | Passed — zero vulnerabilities after replacement tooling                                                                                                                                                                     |
| 2026-07-26 | Starter island/skiff development                           | Island rebuild, solidity, spawn height, mounting, movement                      | Passed for reported hands-on cases                                                                                                                                                                                          |
| 2026-07-26 | Crystal-to-Cutter (`3a2a27e`)                              | Dockmaster, Aether Crystal, Skycutter assembly, travel, cargo, recovery loop    | Partial-to-passed development playtest; user reported testing looked good                                                                                                                                                   |
| 2026-07-26 | Dockyard Refit/Airship Combat `0.2.0`                      | `npm run verify`                                                                | Passed                                                                                                                                                                                                                      |
| 2026-07-26 | Dockyard Refit/Airship Combat `0.2.0`                      | `npm audit --audit-level=high`                                                  | Passed — zero vulnerabilities                                                                                                                                                                                               |
| 2026-07-26 | Dockyard Refit/Airship Combat `0.2.0`                      | Local stable pack deployment                                                    | Passed                                                                                                                                                                                                                      |
| 2026-07-26 | Dockyard Refit/Airship Combat `0.2.0`                      | Focused Minecraft hands-on plan                                                 | Pending                                                                                                                                                                                                                     |
| 2026-07-26 | Phase 3 deterministic-realm foundation                     | `npm run verify`                                                                | Passed — 138 tests, production add-on, and both profiles                                                                                                                                                                    |
| 2026-07-26 | Phase 3 deterministic-realm foundation                     | `npm audit --audit-level=high`                                                  | Passed — zero vulnerabilities                                                                                                                                                                                               |
| 2026-07-26 | Phase 3 deterministic-realm foundation                     | Independent read-only integration review                                        | Passed — no source stop-ship finding                                                                                                                                                                                        |
| 2026-07-26 | Phase 3 deterministic-realm foundation                     | Focused Minecraft hands-on plan                                                 | Pending                                                                                                                                                                                                                     |
| 2026-07-26 | Phase 3 Session C, pre-`0.3.0` bootstrap-recovery build    | Fresh-world bootstrap                                                           | Failed — starter appeared only after `/skyknights:island`; initial arrival required `/skyknights:recover`; Ember Outpost and Frostspire did not appear                                                                      |
| 2026-07-26 | `0.3.0` bootstrap-recovery playtest build                  | `npm run verify`                                                                | Passed — 147 tests across 17 files, production add-on, and both profiles                                                                                                                                                    |
| 2026-07-26 | `0.3.0` bootstrap-recovery playtest build                  | `npm audit --audit-level=high`                                                  | Passed — zero vulnerabilities                                                                                                                                                                                               |
| 2026-07-26 | `0.3.0` bootstrap-recovery playtest build                  | Production package and profiles with `.env` absent                              | Passed — documented defaults produced the versioned add-on and both profiles                                                                                                                                                |
| 2026-07-26 | `0.3.0` bootstrap-recovery playtest build                  | Independent read-only release review                                            | Passed — no source stop-ship finding; ready for hands-on testing                                                                                                                                                            |
| 2026-07-26 | `0.3.0` bootstrap-recovery playtest build                  | Focused Minecraft hands-on plan                                                 | Pending — implementation has not yet been retested in Minecraft                                                                                                                                                             |
| 2026-07-26 | `0.3.0` test 4, pre-`0.3.1` integrity corrective slice     | Fresh-world bootstrap                                                           | Failed — starter island was visibly placed but `activeJob` remained `starter_island:queued`; first-player arrival and `/skyknights:recover` correctly deferred                                                              |
| 2026-07-26 | `0.3.1` starter-resource/integrity corrective slice        | Host tests and focused Minecraft hands-on plan                                  | Host tests passed — 151 tests across 18 files; Minecraft retest pending                                                                                                                                                     |
| 2026-07-26 | `0.3.1` integrated source                                  | `npm run verify`                                                                | Passed — 153 tests across 19 files, NBT fixture tests, production add-on, and both profiles                                                                                                                                 |
| 2026-07-26 | `0.3.1` integrated source                                  | `npm audit --audit-level=high`                                                  | Passed — zero vulnerabilities                                                                                                                                                                                               |
| 2026-07-26 | `0.3.1` BDS harness                                        | BDS `1.26.34.3` two-boot pack load and one GameTest                             | Partial development evidence — dirty worktree; no content errors; exact skiff-seat `onTestPassed` marker; not a clean-commit release result                                                                                 |
| 2026-07-26 | `0.3.1` BDS harness                                        | Independent BDS safety/release review                                           | Passed — no remaining stop-ship issues after failure-safe cleanup, exact result parsing, and atomic-write hardening                                                                                                         |
| 2026-07-26 | `0.3.1` clean commit `9e725c0`                             | BDS `1.26.34.3` two-boot pack load and named skiff-seat GameTest                | Passed — `gitDirty: false`; no content errors; exact `onTestPassed` marker; properties restored; no process, lock, backup, or temporary file remained                                                                       |
| 2026-07-26 | Player-built skycraft roadmap, documentation only          | Prettier, `npm run verify`, `npm audit --audit-level=high`                      | Passed — 161 tests across 20 files on the combined worktree, including separate in-progress testbench changes; zero vulnerabilities; no skycraft runtime claim                                                              |
| 2026-07-26 | Developer test bench and onboarding checkpoint             | `npm run verify`, audit, focused ownership/stack-limit tests, independent QA    | Passed — 162 tests across 20 files; zero vulnerabilities; test-bench runtime hands-on placement, stale-marker, obstruction, and cleanup checks remain pending                                                               |
| 2026-07-27 | Player-built Skycraft `0.3.2` integrated source            | `npm run verify`                                                                | Passed — 206 tests across 35 files, authored structures, stable build, NBT fixtures, production `.mcaddon`, and both profiles                                                                                               |
| 2026-07-27 | Player-built Skycraft `0.3.2` integrated source            | `npm audit --audit-level=high`                                                  | Passed — zero vulnerabilities                                                                                                                                                                                               |
| 2026-07-27 | Player-built Skycraft `0.3.2` dirty worktree               | BDS `1.26.34.3` pack load and existing named skiff-seat GameTest                | Partial — new stable/GameTest content loaded without errors and the named test passed; no Skycraft-specific reconstruction, restart, interaction, or permission proof                                                       |
| 2026-07-27 | Player-built Skycraft `0.3.2` integrated diff              | Independent architecture/release review                                         | Initial NO-GO — found builder launch, component-tier, delayed guest-ejection, and active-craft-cap bypasses                                                                                                                 |
| 2026-07-27 | Player-built Skycraft `0.3.2` final repository gate        | `npm run verify` and `npm audit --audit-level=high`                             | Passed — 207 tests across 35 files, authored structures, TypeScript, NBT, production `.mcaddon`, both profiles, and zero vulnerabilities                                                                                    |
| 2026-07-27 | Player-built Skycraft `0.3.2` final working tree           | BDS `1.26.34.3` pack load and existing named skiff-seat GameTest                | Partial — packs loaded without content errors and the named test passed; Skycraft-specific reconstruction, restart, interaction, and permission tests remain                                                                |
| 2026-07-27 | Player-built Skycraft `0.3.2` final integrated diff        | Independent architecture/release re-review                                      | Passed — GO after owner action, component-tier, pre-mount role/seat-cap, active-craft-cap, parser, and repository hardening                                                                                                 |
| 2026-07-27 | Starter visibility corrective `0.3.3` working tree         | `npm run verify` and `npm audit --audit-level=high`                             | Passed — 209 tests across 35 files, deterministic structures, TypeScript, NBT, production `.mcaddon`, both profiles, and zero vulnerabilities                                                                               |
| 2026-07-27 | Starter visibility corrective `0.3.3` working tree         | BDS `1.26.34.3` pack load and existing named skiff-seat GameTest                | Partial — corrected packs loaded without content errors and the named test passed; client-visible ore placement and void-template presentation were not exercised                                                           |
| 2026-07-27 | Starter visibility corrective `0.3.3` integrated diff      | Independent migration/resource/release review                                   | Passed — GO after pre-schema-5 generated islands were conservatively protected from content-version restamping                                                                                                              |
| 2026-07-27 | Procedural archipelago `0.3.4` integrated working tree     | `npm run verify` and `npm audit --audit-level=high`                             | Passed — 224 tests across 39 files, deterministic structures, TypeScript, NBT, production `.mcaddon`, both profiles, and zero vulnerabilities                                                                               |
| 2026-07-27 | Procedural archipelago `0.3.4` integrated working tree     | BDS `1.26.34.3` pack load and existing named skiff-seat GameTest                | Partial — all stable/GameTest content loaded and the named test passed; no client exploration, clustering, obstruction, reload, performance, or void-world proof                                                            |
| 2026-07-27 | Procedural archipelago `0.3.4` integrated diff             | Independent architecture/migration/performance/release review                   | Passed — GO after player/entity placement races, starvation, ID aliases, unbounded diagnostics, API-status docs, and hands-on obstruction steps were corrected                                                              |
| 2026-07-27 | Starter boulder correction `0.3.5` integrated working tree | `npm run verify` and `npm audit --audit-level=high`                             | Passed — 225 tests across 39 files, deterministic structures, TypeScript, NBT, production `.mcaddon`, both profiles, and zero vulnerabilities                                                                               |
| 2026-07-27 | Starter boulder correction `0.3.5` integrated working tree | BDS `1.26.34.3` pack load and existing named skiff-seat GameTest                | Passed — stable and GameTest packs loaded and `skyknights:skiff_has_pilot_and_passenger_seats` passed; visible boulder mining remains a client hands-on gate                                                                |
| 2026-07-27 | Void-template `0.3.5` integrated working tree              | BDS `1.26.34.3` fixed-seed void-source creation, full-height scans, and restart | Passed — 17 origin/distant chunks and 1,671,168 blocks through Y=-64..319 were air; Survival/debug/spawn/seed/experiment metadata passed; source SHA-256 `a299a218ee146c607bb6735bbf3fcd343a1f623f657151948e50c074b12577b2` |
| 2026-07-27 | Void-template `0.3.5` integrated working tree              | End-to-end `npm run world-template:void` and archive inspection                 | Passed — 138,918-byte `.mctemplate`, 118 sorted root entries, no wrapper, exact `0.3.5` pack refs; SHA-256 `9f9cfbf6292245df8ffb16a7fb248ed2af2f5665439c7c087b3c44c0461adb7c`; clean-client import pending                  |
| 2026-07-27 | Starter boulder + void-template `0.3.5` final working tree | `npm run verify`, audit, and BDS skiff-seat smoke                               | Passed — 228 tests across 40 files, deterministic structures, TypeScript/NBT, production packages/profiles, zero vulnerabilities, and named BDS GameTest                                                                    |
| 2026-07-28 | Aether Outrigger `0.3.7` isolated working-tree slice       | Asset/content contracts, `npm run verify`, and npm audit                        | Passed — 241 tests across 42 files, deterministic structures, TypeScript/NBT, production `.mcaddon`, both profiles, and zero vulnerabilities; rendering, UVs, seats, handling, multiplayer, and reload pending in Minecraft |
| 2026-07-28 | Aether Outrigger `0.3.7` combined working tree             | BDS smoke attempt                                                               | Blocked before server launch by separate concurrent multipart-generation edits in `scripts/persistence/schema.ts`; no Outrigger content-load result claimed                                                                 |
| 2026-07-28 | Island variety `0.3.8` integrated combined working tree    | Targeted planner/runtime/structure/persistence/multipart-service tests          | Passed — 39 tests across 6 files; coverage includes stale-cursor recovery, zero-placement late-obstruction preflight, checkpointed-player-edit preservation, and structure-verified safe docks                              |
| 2026-07-28 | Island variety `0.3.8` integrated combined working tree    | `npm run verify` and `npm audit --audit-level=high`                             | Passed — 265 tests across 45 files, all 35 generated structures, formatting, TypeScript, NBT fixtures, production `.mcaddon`, both profiles, and zero vulnerabilities; includes concurrent owner prototype work             |
| 2026-07-28 | Island variety `0.3.8` integrated diff                     | Independent architecture/migration/preservation/release review                  | Passed — GO after complete multipart preflight, checkpointed-edit preservation, safe-dock index verification, budget/spec reconciliation, and timeout hardening; Minecraft acceptance remains pending                       |

| 2026-07-28 | Steampunk Blimp `0.3.8` integrated working-tree slice | Deterministic asset regeneration, focused contracts, and corrected production archive inspection | Passed — 11 bones, 124 cubes, 744 opaque-mapped faces, five focused tests, corrected seat/collision/root/rib contracts, and all BP/RP assets present in the 171,896-byte `.mcaddon`; SHA-256 `e8f4bfc1cf1cd66c9a68dca069b704f51fa2a10e3a5618c50c973aea3a6127f3`; Minecraft visual, animation, seat, handling, reload, and multiplayer gates remain pending |
| 2026-07-28 | Steampunk Blimp `0.3.8` final integrated package | Independent entity-art, integration, and release re-review | Passed — GO after bow-seat, safe-dismount, collision-compromise, root hierarchy, rib-clearance, and stale-package findings were corrected; no automated or packaging stop-ship remains |
| 2026-07-28 | Large prototype scale/camera correction `0.3.9` pre-QA working tree | `npm run verify`, `npm audit --audit-level=high`, focused prototype contracts, and recursive production archive inspection | Passed before retry correction — 271 tests across 46 files, 14 focused prototype tests, all 35 generated structures, formatting, TypeScript, NBT fixtures, production `.mcaddon`, both profiles, and zero vulnerabilities; QA then found that throwable activation/cleanup calls needed retained retry state, which was corrected before the final gate below |
| 2026-07-28 | Large prototype scale/camera correction `0.3.9` final integrated working tree | `npm run verify`, `npm audit --audit-level=high`, 15 focused prototype contracts, model-generator idempotence, and recursive production archive inspection | Passed — 272 tests across 46 files, all 35 generated structures, formatting, TypeScript, NBT fixtures, production `.mcaddon`, both profiles, and zero vulnerabilities; both nested packs report `0.3.9`, all nine prototype BP/RP assets and the camera runtime are present in the 172,661-byte package; SHA-256 `40ecd88960c41c6e7608e413dfe4f6ee5584fd374adfc76b9110a17e34d852f3`; Minecraft camera, scale, seat, collision, input, and comfort gates remain pending |
| 2026-07-28 | Large prototype scale/camera correction `0.3.9` final integrated diff and package | Independent stable-API, runtime-state, model/seat/collision, documentation, and release review | Passed — GO after throwable camera activation/cleanup gained retained retry states and the mount-scoped perspective-lock contract was documented honestly; package size/hash and final 272-test gate independently matched; Minecraft rendering, camera comfort, seats, dismount, reload, multiplayer, and input/device gates remain pending |
| 2026-07-28 | Fibonacci/large ambient islands `0.3.10` integrated pre-QA working tree | 47 focused planner/structure/runtime/persistence/multipart tests, `npm run verify`, `npm audit --audit-level=high`, generated-asset catalog comparison, and recursive production archive inspection | Passed — 287 tests across 48 files, all 63 generated structures, formatting, TypeScript, stable bundle, BDS NBT fixtures, production `.mcaddon`, both profiles, and zero vulnerabilities; both nested packs report `0.3.10`, all 28 `a3` structures are packaged, and the 207,063-byte archive has SHA-256 `0de7282608be6659381d0fd8a704447a6854d35a11336d5406bd9a3181038f5e`; fresh void-world distribution, scale, seams, reload, multiplayer, and device performance remain pending |
| 2026-07-29 | Formula-continent prerequisite benchmark | `npm run test:bds:fillblocks-benchmark` on BDS `1.26.34.3`; retained artifact run `2026-07-29T13-04-10-266Z` | Passed — exact `fillBlocks` ceiling is 32,768 blocks: 32,768 filled and the asserted 32,769-block probe threw; six 16×40×16 samples were 6/6/6/6/6/6 ms (6 ms average); both `ignoreChunkBoundErrors=false/true` threw across an unloaded span; paired four-fill/one-fill averages were 22/20.5 ms (1.073 ratio); this is BDS-host evidence, not weakest-client evidence |
| 2026-07-29 | `a4` clustered archipelago and 600-block `c1` formula-continent integrated working tree | 109 focused field/chunk/streaming/persistence/executor/planner/runtime/multipart/benchmark tests and stable TypeScript bundle | Passed — all 12 focused files green; coverage includes four-deck center separation, full formula-footprint reservation, legacy suppression/recovery, fixed/canonical bitsets, corrupt-state fail-closed behavior, exact in-flight chunk replay, shared-cap rejection, fully loaded chunk execution, air-only preservation, entity deferral, service-wide failure backoff, structure-job pause/replay, and four-call tick batching; Minecraft appearance, pacing, interruption, multiplayer, and weakest-device acceptance remain pending |
| 2026-07-29 | Archipelago recovery post-QA release gate | `npm run verify`, `npm audit --audit-level=high`, and production package hash | Passed — all 63 generated structures, formatting, TypeScript/stable bundle, 389 tests across 59 files, BDS NBT fixtures, 223,210-byte production `.mcaddon`, experimental/GameTest profiles, and zero vulnerabilities; package SHA-256 `fc8f78a06e156300f7209bd7985ef51727f8d7410871ed9cdc4a7999414f0deb` |
| 2026-07-29 | Archipelago recovery final integrated diff and package | Independent determinism, migration, persistence, scheduler-starvation, BDS-harness safety, documentation, and release review | Passed — GO for the automated/source checkpoint with no remaining source findings after exact cap proof, entity-specific cooldown, service-wide failure backoff, structure-job pause/replay, shared-cap rejection, authenticated runner settings, and confirmed shutdown cleanup; Minecraft migration, appearance, interruption, multiplayer, long-session, and weakest-device gates remain pending |

## Hands-on development evidence

These checks were reported during iterative Minecraft testing before the
Crystal-to-Cutter baseline commit.

| Area                    | Observation and resolution                                                                                                                      | Result                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Custom commands         | `/skyknights:debug` initially appeared unknown; startup registration was corrected.                                                             | Passed after correction               |
| Island recovery         | `/skyknights:island` restored the island.                                                                                                       | Passed                                |
| Skiff spawn             | The skiff initially appeared two blocks too high; launch placement was corrected.                                                               | Passed after correction               |
| Skiff mounting          | Collision initially looked like fall-through behavior, then right-click mounting was confirmed.                                                 | Passed                                |
| Skiff flight            | Mounted movement was reported correct.                                                                                                          | Passed                                |
| Starter island          | Gapped/partial surfaces and inconsistent reload generation were corrected with a substantially solid, versioned structure and integrity checks. | Passed for the reported reload test   |
| Dockmaster              | Missing Dockmaster behavior was corrected with periodic self-healing at the starter dock.                                                       | Implemented; regression plan retained |
| TypeScript build        | Named module slots replaced an obsolete string-array assignment in `skiff.ts`.                                                                  | Passed                                |
| Crystal-to-Cutter slice | User reported the focused testing looked good before requesting the next slice.                                                                 | Passed for that development session   |

## Automated `0.2.0` evidence

### Full repository verification

Command:

```powershell
npm run verify
```

Completed stages:

| Stage                                                        | Result                         |
| ------------------------------------------------------------ | ------------------------------ |
| Regenerate all three island structures and GameTest platform | Passed                         |
| Prettier/lint over 40 source/tool files                      | Passed                         |
| TypeScript type check and stable bundle                      | Passed                         |
| Vitest                                                       | 25 tests passed across 8 files |
| Production `.mcaddon`                                        | Built                          |
| Experimental custom-dimension profile                        | Built                          |
| GameTest profile                                             | Built                          |

Generated artifacts:

```text
dist/packages/sky_knights.mcaddon
dist/profiles/sky_knights_experimental.mcpack
dist/profiles/sky_knights_gametest.mcpack
```

### Dependency security

Command:

```powershell
npm audit --audit-level=high
```

Result:

```text
found 0 vulnerabilities
```

The accepted dependency policy and eliminated deprecated packages are recorded
in [`DEVELOPMENT_ENVIRONMENT.md`](DEVELOPMENT_ENVIRONMENT.md).

## Automated Phase 3 foundation and `0.3.0` bootstrap-recovery evidence

Command:

```powershell
npm run verify
npm audit --audit-level=high
```

Results:

| Stage                                                                    | Result                           |
| ------------------------------------------------------------------------ | -------------------------------- |
| Non-mutating comparison of eight island structures and GameTest platform | Passed                           |
| Prettier/lint                                                            | 63 files passed                  |
| TypeScript/stable bundle                                                 | Passed                           |
| Vitest                                                                   | 147 tests passed across 17 files |
| Production `.mcaddon`                                                    | Built                            |
| Experimental custom-dimension profile                                    | Built                            |
| GameTest profile                                                         | Built                            |
| High-severity dependency audit                                           | Passed — zero vulnerabilities    |

The host suite covers deterministic placement across 512 seeds, pinned-origin
compatibility, schema migrations through world schema 5, persistent layout
records, player-modified flags, destination readiness/activation, executable
content identifiers, localization, progression closure, negative soft-lock
cases, generation retry/backoff, and delayed first-player bootstrap arrival.

This is repository and packaging evidence only. The reported pre-`0.3.0`
fresh-world failure is recorded above; the bootstrap fix, schema-4 migration,
player-modified terrain, interruption recovery, and stable-API behavior still
require the
[`Phase 3 Stabilization Hands-On Test Plan`](PHASE_3_STABILIZATION_TEST_PLAN.md).

The `0.3.1` integrated automated gate is green: 153 host tests across 19 files,
NBT fixture tests, production packaging, both profile builds, and a
zero-vulnerability audit passed. A clean-commit BDS smoke at `9e725c0` also
passed, proving the exact selected server-side GameTest and pack-load contract
with `gitDirty: false`. Minecraft client retesting remains pending.

### Local deployment

Command:

```powershell
node tools/project.mjs local-deploy --once
```

Result: stable scripts built and both `0.2.0` packs deployed to:

```text
%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang\development_behavior_packs\sky_knights
%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang\development_resource_packs\sky_knights
```

## Hands-on sessions

### 2026-07-27 — `0.3.6` void-template playtest (Sessions A, A2, B passed)

| Field            | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| Build            | `0.3.6`, commit `bdbc1f3`                                    |
| World            | Fresh world created from `sky_knights_void_world.mctemplate` |
| Packs            | Embedded template packs                                      |
| Platform         | Windows, Minecraft Bedrock (exact version not captured)      |
| Sessions covered | Archipelago plan A, A2, B                                    |
| Result           | **Passed**                                                   |

- Session A — bootstrap, world type, and version: passed.
- Session A2 — starter resource route: passed. The 2.5x reachable resource
  budget resolved the `0.3.5` iron failure.
- Session B — nearby lazy generation: passed. Ambient islands appeared without
  a developer command.

The template had to be installed with `npm run world-template:install`; the
double-click import path does nothing on this machine because no Minecraft file
extension is registered with Windows.

Not captured in this entry: exact Minecraft version, measured placement hitch,
client FPS, and the Content Log transcript. Record those on the next session.

Still open from this plan: Sessions C (family clusters), D (reload and
duplicate safety), E (occupied-volume protection), F (normal-world
compatibility), and G (exploration and cap).

Defect found during the session, outside the plan: destroying the dock deck
beneath the Dockmaster is not handled. See the open-defect note below.

### 2026-07-27 — `0.3.5` starter-route playtest (partial, failed)

| Field            | Value                                                            |
| ---------------- | ---------------------------------------------------------------- |
| Build            | `0.3.5`, commit `82c3398`                                        |
| World            | `voidtest`, fresh normal **Infinite** Overworld (`Generator=1`)  |
| Packs            | Development packs from `local-deploy`, not the packaged template |
| Platform         | Windows, Minecraft Bedrock                                       |
| Sessions covered | Archipelago plan Session A, partial                              |
| Result           | **Failed** — two defects found                                   |

Findings:

1. **Insufficient starter iron.** The Ship Core recipe needs 4 iron ingots and
   the Thruster Module 3, for 7 total. Only 2 iron were found. The island
   contained 12 iron blocks, but 10 sat on the tapered underside and sheer side
   faces, which are unreachable before the skiff that iron pays for. Fixed in
   `0.3.6` by raising iron to 18, moving all ore into the surface-reachable
   band, and applying a uniform 2.5x margin to every starter resource.
2. **Wrong world type for the intended presentation.** Ordinary Overworld
   terrain generated beneath the realm. The world was created as a normal
   Infinite world with the development packs rather than from
   `sky_knights_void_world.mctemplate`; no template had been imported. The
   packaged template itself was inspected afterwards and is correct:
   `Generator=2`, one `minecraft:air` layer, and no pre-generated chunks. Fixed
   in `0.3.6` by adding a `below=` line to `/skyknights:debug` so the world type
   is visible in game before a session is spent on the wrong presentation.

Not covered: automatic arrival timing, `activeJob` settling, archipelago count,
Content Log review, and every later session. Session A must be rerun in full on
a world created from the `0.3.6` template.

## Open defects

### D-1 — the Dockmaster falls forever when its dock deck is destroyed

Found 2026-07-27 during the `0.3.6` session. **Fixed in `0.3.7`**; the in-game
behaviour is not yet confirmed in a client.

The Dockmaster stands at world `(12.5, 161, 0.5)`, which is starter-island
local `(24, 12, 10)`, directly on the oak-plank dock deck. Reading the current
code rather than observing the loop:

- `dockmaster.json` sets `minecraft:physics` with `has_gravity: true`, so
  removing the plank beneath it makes it fall;
- its `minecraft:damage_sensor` declares `deals_damage: no` for all triggers,
  so it cannot be killed — including by the void;
- `ensureDockmaster` runs every 200 ticks and teleports any displaced
  Dockmaster back to the dock anchor
  (`scripts/gameplay/dockyard.ts`);
- `shouldEnsureDockmaster` returns true whenever the island is recorded, so the
  missing deck does not stop it.

The predicted result is an indefinite ten-second fall-and-return loop with a
`Displaced Dockmaster returned to the starter dock.` warning each cycle. This
has not been confirmed in a client yet; confirm before fixing.

Breaking the deck also marks the starter island `playerModified`, so the deck
is never automatically restamped. Player recovery is not affected: the safe
dock anchor at local `(21.5, 12, 10.5)` stands on island grass, not on the
plank deck.

## Current manual acceptance state

The repository is ready for both the
[`Phase 3 stabilization plan`](PHASE_3_STABILIZATION_TEST_PLAN.md) and the
remaining [`0.2.0` focused plan](DOCKYARD_REFIT_COMBAT_TEST_PLAN.md), but those
results have not yet been recorded.

| Manual area                                                        | State                                      |
| ------------------------------------------------------------------ | ------------------------------------------ |
| Schema-4 → schema-5 migration and deterministic layout persistence | Pending                                    |
| Player-modified island protection                                  | Pending                                    |
| Structure-only island activation isolation                         | Pending                                    |
| Interrupted registry-backed generation                             | Pending                                    |
| Pack load and Content Log on `0.3.1`                               | Pending                                    |
| `0.3.1` automatic fresh-world bootstrap without developer commands | Pending — pre-fix Sessions C/test 4 failed |
| `0.3.1` starter-resource-to-skiff route                            | Pending                                    |
| Existing-world schema/content migration                            | Pending                                    |
| Fresh full Survival progression                                    | Pending                                    |
| Every refit transaction and visual                                 | Pending                                    |
| Armored hull, engine speed, cargo size, cannon, shield effects     | Pending                                    |
| Raider spawning, AI, damage, defeat, reward, and persistence       | Pending                                    |
| Owner/gunner multiplayer permissions                               | Pending                                    |
| Keyboard/mouse combat ergonomics                                   | Pending                                    |
| Controller and touch combat ergonomics                             | Pending                                    |
| Reload, recall, destruction, and reconstruction matrix             | Pending                                    |
| Clean-client import and world template                             | Pending                                    |

When a session is completed, append a dated entry containing:

- Git commit and pack version;
- Minecraft version, platform, and input method;
- world type (fresh or upgraded);
- test-plan sessions completed;
- pass/fail result;
- Content Log status;
- defect links or exact reproduction notes.
