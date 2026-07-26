# Validation Log

This ledger records what was actually checked. Planned tests belong in the
focused test plans; only completed evidence belongs here.

Status meanings:

- **Passed** — the stated check ran and met its expectation.
- **Partial** — useful behavior was exercised, but the complete matrix was not.
- **Pending** — implemented but not yet tested through the stated gate.
- **Non-blocking experimental** — failure does not block the stable strategy.

## Evidence summary

| Date | Build/state | Validation | Result |
| --- | --- | --- | --- |
| 2026-07-25 | Scaffold (`07ecfe2`) | Local toolchain, stable build scaffold, fixed manifests, CI setup | Passed |
| 2026-07-26 | Dependency/tooling cleanup | `npm ci`, deprecated transitive dependency removal, audit remediation | Passed — zero vulnerabilities after replacement tooling |
| 2026-07-26 | Starter island/skiff development | Island rebuild, solidity, spawn height, mounting, movement | Passed for reported hands-on cases |
| 2026-07-26 | Crystal-to-Cutter (`3a2a27e`) | Dockmaster, Aether Crystal, Skycutter assembly, travel, cargo, recovery loop | Partial-to-passed development playtest; user reported testing looked good |
| 2026-07-26 | Dockyard Refit/Airship Combat `0.2.0` | `npm run verify` | Passed |
| 2026-07-26 | Dockyard Refit/Airship Combat `0.2.0` | `npm audit --audit-level=high` | Passed — zero vulnerabilities |
| 2026-07-26 | Dockyard Refit/Airship Combat `0.2.0` | Local stable pack deployment | Passed |
| 2026-07-26 | Dockyard Refit/Airship Combat `0.2.0` | Focused Minecraft hands-on plan | Pending |

## Hands-on development evidence

These checks were reported during iterative Minecraft testing before the
Crystal-to-Cutter baseline commit.

| Area | Observation and resolution | Result |
| --- | --- | --- |
| Custom commands | `/skyknights:debug` initially appeared unknown; startup registration was corrected. | Passed after correction |
| Island recovery | `/skyknights:island` restored the island. | Passed |
| Skiff spawn | The skiff initially appeared two blocks too high; launch placement was corrected. | Passed after correction |
| Skiff mounting | Collision initially looked like fall-through behavior, then right-click mounting was confirmed. | Passed |
| Skiff flight | Mounted movement was reported correct. | Passed |
| Starter island | Gapped/partial surfaces and inconsistent reload generation were corrected with a substantially solid, versioned structure and integrity checks. | Passed for the reported reload test |
| Dockmaster | Missing Dockmaster behavior was corrected with periodic self-healing at the starter dock. | Implemented; regression plan retained |
| TypeScript build | Named module slots replaced an obsolete string-array assignment in `skiff.ts`. | Passed |
| Crystal-to-Cutter slice | User reported the focused testing looked good before requesting the next slice. | Passed for that development session |

## Automated `0.2.0` evidence

### Full repository verification

Command:

```powershell
npm run verify
```

Completed stages:

| Stage | Result |
| --- | --- |
| Regenerate all three island structures and GameTest platform | Passed |
| Prettier/lint over 40 source/tool files | Passed |
| TypeScript type check and stable bundle | Passed |
| Vitest | 25 tests passed across 8 files |
| Production `.mcaddon` | Built |
| Experimental custom-dimension profile | Built |
| GameTest profile | Built |

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

The repository is ready for the
[`0.2.0` focused plan](DOCKYARD_REFIT_COMBAT_TEST_PLAN.md), but those results
have not yet been recorded.

| Manual area | State |
| --- | --- |
| Pack load and Content Log on `0.2.0` | Pending |
| Existing-world schema/content migration | Pending |
| Fresh full Survival progression | Pending |
| Every refit transaction and visual | Pending |
| Armored hull, engine speed, cargo size, cannon, shield effects | Pending |
| Raider spawning, AI, damage, defeat, reward, and persistence | Pending |
| Owner/gunner multiplayer permissions | Pending |
| Keyboard/mouse combat ergonomics | Pending |
| Controller and touch combat ergonomics | Pending |
| Reload, recall, destruction, and reconstruction matrix | Pending |
| Clean-client import and world template | Pending |

When a session is completed, append a dated entry containing:

- Git commit and pack version;
- Minecraft version, platform, and input method;
- world type (fresh or upgraded);
- test-plan sessions completed;
- pass/fail result;
- Content Log status;
- defect links or exact reproduction notes.
