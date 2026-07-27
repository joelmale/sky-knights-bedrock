# Validation Log

This ledger records what was actually checked. Planned tests belong in the
focused test plans; only completed evidence belongs here.

Status meanings:

- **Passed** — the stated check ran and met its expectation.
- **Partial** — useful behavior was exercised, but the complete matrix was not.
- **Pending** — implemented but not yet tested through the stated gate.
- **Non-blocking experimental** — failure does not block the stable strategy.

## Evidence summary

| Date       | Build/state                                             | Validation                                                                   | Result                                                                                                                                                         |
| ---------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-25 | Scaffold (`07ecfe2`)                                    | Local toolchain, stable build scaffold, fixed manifests, CI setup            | Passed                                                                                                                                                         |
| 2026-07-26 | Dependency/tooling cleanup                              | `npm ci`, deprecated transitive dependency removal, audit remediation        | Passed — zero vulnerabilities after replacement tooling                                                                                                        |
| 2026-07-26 | Starter island/skiff development                        | Island rebuild, solidity, spawn height, mounting, movement                   | Passed for reported hands-on cases                                                                                                                             |
| 2026-07-26 | Crystal-to-Cutter (`3a2a27e`)                           | Dockmaster, Aether Crystal, Skycutter assembly, travel, cargo, recovery loop | Partial-to-passed development playtest; user reported testing looked good                                                                                      |
| 2026-07-26 | Dockyard Refit/Airship Combat `0.2.0`                   | `npm run verify`                                                             | Passed                                                                                                                                                         |
| 2026-07-26 | Dockyard Refit/Airship Combat `0.2.0`                   | `npm audit --audit-level=high`                                               | Passed — zero vulnerabilities                                                                                                                                  |
| 2026-07-26 | Dockyard Refit/Airship Combat `0.2.0`                   | Local stable pack deployment                                                 | Passed                                                                                                                                                         |
| 2026-07-26 | Dockyard Refit/Airship Combat `0.2.0`                   | Focused Minecraft hands-on plan                                              | Pending                                                                                                                                                        |
| 2026-07-26 | Phase 3 deterministic-realm foundation                  | `npm run verify`                                                             | Passed — 138 tests, production add-on, and both profiles                                                                                                       |
| 2026-07-26 | Phase 3 deterministic-realm foundation                  | `npm audit --audit-level=high`                                               | Passed — zero vulnerabilities                                                                                                                                  |
| 2026-07-26 | Phase 3 deterministic-realm foundation                  | Independent read-only integration review                                     | Passed — no source stop-ship finding                                                                                                                           |
| 2026-07-26 | Phase 3 deterministic-realm foundation                  | Focused Minecraft hands-on plan                                              | Pending                                                                                                                                                        |
| 2026-07-26 | Phase 3 Session C, pre-`0.3.0` bootstrap-recovery build | Fresh-world bootstrap                                                        | Failed — starter appeared only after `/skyknights:island`; initial arrival required `/skyknights:recover`; Ember Outpost and Frostspire did not appear         |
| 2026-07-26 | `0.3.0` bootstrap-recovery playtest build               | `npm run verify`                                                             | Passed — 147 tests across 17 files, production add-on, and both profiles                                                                                       |
| 2026-07-26 | `0.3.0` bootstrap-recovery playtest build               | `npm audit --audit-level=high`                                               | Passed — zero vulnerabilities                                                                                                                                  |
| 2026-07-26 | `0.3.0` bootstrap-recovery playtest build               | Production package and profiles with `.env` absent                           | Passed — documented defaults produced the versioned add-on and both profiles                                                                                   |
| 2026-07-26 | `0.3.0` bootstrap-recovery playtest build               | Independent read-only release review                                         | Passed — no source stop-ship finding; ready for hands-on testing                                                                                               |
| 2026-07-26 | `0.3.0` bootstrap-recovery playtest build               | Focused Minecraft hands-on plan                                              | Pending — implementation has not yet been retested in Minecraft                                                                                                |
| 2026-07-26 | `0.3.0` test 4, pre-`0.3.1` integrity corrective slice  | Fresh-world bootstrap                                                        | Failed — starter island was visibly placed but `activeJob` remained `starter_island:queued`; first-player arrival and `/skyknights:recover` correctly deferred |
| 2026-07-26 | `0.3.1` starter-resource/integrity corrective slice     | Host tests and focused Minecraft hands-on plan                               | Host tests passed — 151 tests across 18 files; Minecraft retest pending                                                                                        |
| 2026-07-26 | `0.3.1` integrated source                               | `npm run verify`                                                             | Passed — 153 tests across 19 files, NBT fixture tests, production add-on, and both profiles                                                                    |
| 2026-07-26 | `0.3.1` integrated source                               | `npm audit --audit-level=high`                                               | Passed — zero vulnerabilities                                                                                                                                  |
| 2026-07-26 | `0.3.1` BDS harness                                     | BDS `1.26.34.3` two-boot pack load and one GameTest                          | Partial development evidence — dirty worktree; no content errors; exact skiff-seat `onTestPassed` marker; not a clean-commit release result                    |
| 2026-07-26 | `0.3.1` BDS harness                                     | Independent BDS safety/release review                                        | Passed — no remaining stop-ship issues after failure-safe cleanup, exact result parsing, and atomic-write hardening                                            |
| 2026-07-26 | `0.3.1` clean commit `9e725c0`                          | BDS `1.26.34.3` two-boot pack load and named skiff-seat GameTest             | Passed — `gitDirty: false`; no content errors; exact `onTestPassed` marker; properties restored; no process, lock, backup, or temporary file remained          |
| 2026-07-26 | Player-built skycraft roadmap, documentation only       | Prettier, `npm run verify`, `npm audit --audit-level=high`                   | Passed — 161 tests across 20 files on the combined worktree, including separate in-progress testbench changes; zero vulnerabilities; no skycraft runtime claim |
| 2026-07-26 | Developer test bench and onboarding checkpoint          | `npm run verify`, audit, focused ownership/stack-limit tests, independent QA | Passed — 162 tests across 20 files; zero vulnerabilities; test-bench runtime hands-on placement, stale-marker, obstruction, and cleanup checks remain pending  |
| 2026-07-27 | Player-built Skycraft `0.3.2` integrated source         | `npm run verify`                                                             | Passed — 206 tests across 35 files, authored structures, stable build, NBT fixtures, production `.mcaddon`, and both profiles                                 |
| 2026-07-27 | Player-built Skycraft `0.3.2` integrated source         | `npm audit --audit-level=high`                                               | Passed — zero vulnerabilities                                                                                                                                  |
| 2026-07-27 | Player-built Skycraft `0.3.2` dirty worktree            | BDS `1.26.34.3` pack load and existing named skiff-seat GameTest             | Partial — new stable/GameTest content loaded without errors and the named test passed; no Skycraft-specific reconstruction, restart, interaction, or permission proof |
| 2026-07-27 | Player-built Skycraft `0.3.2` integrated diff           | Independent architecture/release review                                      | Initial NO-GO — found builder launch, component-tier, delayed guest-ejection, and active-craft-cap bypasses                                                         |
| 2026-07-27 | Player-built Skycraft `0.3.2` final repository gate     | `npm run verify` and `npm audit --audit-level=high`                           | Passed — 207 tests across 35 files, authored structures, TypeScript, NBT, production `.mcaddon`, both profiles, and zero vulnerabilities                            |
| 2026-07-27 | Player-built Skycraft `0.3.2` final working tree        | BDS `1.26.34.3` pack load and existing named skiff-seat GameTest             | Partial — packs loaded without content errors and the named test passed; Skycraft-specific reconstruction, restart, interaction, and permission tests remain       |
| 2026-07-27 | Player-built Skycraft `0.3.2` final integrated diff     | Independent architecture/release re-review                                   | Passed — GO after owner action, component-tier, pre-mount role/seat-cap, active-craft-cap, parser, and repository hardening                                        |

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
