# BDS/GameTest Harness

This is an opt-in, three-layer validation strategy for Sky Knights. It adds
repeatable server-side smoke coverage; it does not replace host tests or real
Minecraft hands-on acceptance.

## Three validation layers

| Layer              | Purpose                                                                                                                              | Gate                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Host tests         | Pure rules: persistence, recipes, structure bytes, progression, deterministic layouts, and retry policy                              | Required for every slice                                          |
| BDS/GameTest smoke | Pack loading, Script API wiring, structures, commands, GameTest execution, and scripted player scenarios in a managed server sandbox | Opt-in until the harness is proven on the supported BDS/game pair |
| Hands-on Minecraft | Real client import, UI/input, rendering, multiplayer behavior, performance, recovery feel, and Content Log review                    | Required release/playtest evidence                                |

Passing a lower layer never implies a pass at a higher layer.

## Status and compatibility

`npm run test:bds:smoke` is implemented and has passed locally with BDS
`1.26.34.3`, the `0.3.1` stable packs, and the GameTest manifest dependency
`@minecraft/server-gametest` `1.0.0-beta`. The npm development dependency keeps
the build-specific `1.0.0-beta.1.26.33-stable` type package; the shorter
manifest version is the runtime module identifier BDS reports as available.

The current harness deliberately supports only BDS `1.26.34.3` for its
`level.dat` bootstrap. It rejects another BDS version until that version's
experiment format and GameTest runtime are verified. Every recorded run must
identify:

- BDS binary version;
- Behavior Pack module/API versions;
- GameTest profile/API version; and
- the Minecraft client build used for any follow-up hands-on check.

The initial implementation smoke was run from a dirty `0.3.1` worktree and was
development evidence only. The hardened harness then passed from clean commit
`9e725c0`, recording `gitDirty: false`, the exact named `onTestPassed` marker,
no content errors, restored server properties, and no surviving process, lock,
backup, or temporary properties file.

Do not silently fall back to a different server or preview API version. A
successful smoke run proves the selected server-side pack load and named
GameTest only; stable client acceptance and other experimental profiles remain
separate.

## External BDS setup

The repository does not download, redistribute, or accept the Minecraft
Bedrock Dedicated Server terms for a tester. Download BDS manually from the
official Minecraft source, accept the displayed EULA/privacy terms, and extract
it outside the repository.

Set `SKY_KNIGHTS_BDS_ROOT` to that external extraction directory. It must point
to one explicit, test-only BDS installation, not a parent directory containing
multiple versions. Keep the server executable, downloaded packs, world data,
and license files outside Git. The runner reads the process environment first
and then the ignored repository `.env` file.

Example PowerShell setup:

```powershell
$env:SKY_KNIGHTS_BDS_ROOT = "D:\Minecraft\bedrock-server-1.26.34.3"
npm run test:bds:smoke
```

Or copy `.env.example` to `.env` and set `SKY_KNIGHTS_BDS_ROOT` there.

The runner also requires an explicit opt-in sentinel in that dedicated root.
Create it only after confirming the directory contains no valued server world:

```powershell
$root = "D:\Minecraft\bedrock-server-1.26.34.3"
$utf8 = [Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText(
  (Join-Path $root ".sky-knights-bds-test-root"),
  "sky-knights-bds-test-root-v1`n",
  $utf8
)
```

## Managed sandbox contract

The runner owns only these fixed children of the sentinel-marked BDS root:

- `worlds/sky_knights_bds_smoke`;
- `behavior_packs/sky_knights_bds_stable`;
- `behavior_packs/sky_knights_bds_gametest`;
- `resource_packs/sky_knights_bds_resources`;
- `sky_knights_bds_artifacts`; and
- `.sky-knights-bds-smoke.lock` plus the recoverable
  `.sky-knights-server.properties.backup`.

It rejects filesystem roots, the repository root, the user-profile root, unsafe
top-level BDS links, unmarked installations, unexpected BDS versions, and an
existing run lock. Every run temporarily edits `server.properties`, uses
authenticated online mode, an empty allowlist, LAN visibility disabled, and
ports `19152`/`19153`; the original properties are restored afterward.
Those settings do not guarantee loopback-only binding: BDS still listens on
network interfaces. Keep the dedicated test instance behind the host firewall
and do not expose its UDP ports.

The world is generated in a first clean BDS boot, stopped, backed up to the run
artifacts, patched for cheats/flat generation/the verified `gametest`
experiment, bound to the staged packs, and then loaded in a second boot. The
runner sends `stop` to its child and waits before using a PID-specific process
tree kill on timeout. It never kills by executable name or deletes a
user-named world. Artifacts and the last disposable test world remain for
diagnosis; the next run replaces only that fixed world and staged pack copies.

## Smoke usage

Run:

```powershell
npm run test:bds:smoke
```

The command first runs synthetic NBT tests, builds the stable and GameTest
profiles, performs the two BDS boots, rejects content errors, and executes:

```text
skyknights:skiff_has_pilot_and_passenger_seats
```

It succeeds only after the log contains the named `onTestPassed` event and
returns nonzero for timeout, server exit, content error, pack/module
incompatibility, missing registration, or test failure. The other three
registered component GameTests and progression/recovery scenarios have not yet
been added to this automated run.

## Artifacts and evidence

Every run under `sky_knights_bds_artifacts/<timestamp>` retains:

- `run-metadata.json` with the command, Git checkpoint/dirty state, package
  version, fixed world/ports/test, and exact staged manifests;
- `server.properties.before`;
- `create.log`, `initial-boot.json`, and the pre/post-patch `level.dat`;
- `run.log`; and
- `result.json` with explicit pass/fail evidence.

`run.log` captures BDS console Content Log output. BDS `1.26.34.3` announces a
disk Content Log name but did not expose a separate file in the tested
installation, so the console capture is the retained content-error evidence.

Record a concise outcome in `docs/VALIDATION_LOG.md`. A green process exit
alone is insufficient: the result must include explicit GameTest completion and
no relevant pack-load or script errors.

## Troubleshooting

| Symptom                | First checks                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| BDS cannot start       | `SKY_KNIGHTS_BDS_ROOT`, executable permissions, manual EULA acceptance, port conflict, and the captured server log |
| Pack fails to load     | profile selection, copied manifest/API versions, dependency UUIDs, and Content Log identifiers                     |
| GameTest is absent     | confirm the GameTest profile was built/copied and that BDS supports the matching GameTest API                      |
| BDS version rejected   | use the documented `1.26.34.3` build or validate and deliberately add a new compatibility baseline                 |
| Timeout                | readiness marker, world initialization, server log, stale sentinel, and whether the runner owns the target process |
| Cleanup refuses to run | inspect the sentinel; do not manually delete a sandbox until the recorded process is confirmed stopped             |

## Limits of SimulatedPlayer

`SimulatedPlayer` is valuable for deterministic server-side interaction and
position assertions. It cannot prove client rendering, camera behavior,
keyboard/controller/touch input mapping, menus/forms as experienced by a real
player, frame time, network conditions, import UX, sound/particle presentation,
or real multiplayer synchronization and disconnect behavior. Those remain
hands-on Minecraft gates.

The next BDS automation slice should add one bounded `SimulatedPlayer`
interaction/mounting test. Do not automate Dockmaster forms or vanilla
crafting/furnace UI as though they represented real-client behavior.
