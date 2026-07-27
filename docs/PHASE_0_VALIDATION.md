# Phase 0 Validation

This document separates implemented capability proofs from manual in-engine
results. Do not mark a row as passed until it has been exercised on the named
device and game build.

Use the complete session-by-session
[Hands-On Minecraft Validation Plan](HANDS_ON_TEST_PLAN.md) when executing this
checklist.

## Automated baseline

Run:

```powershell
npm run verify
```

This checks and packages the stable add-on, builds both opt-in profiles, and
runs host-side tests for hashing, schema migration, generation checkpoints, and
structured logging.

## Stable flight and recovery proof

1. Run `npm run local-deploy`.
2. Activate the stable Behavior Pack in a fresh world with cheats enabled.
3. Run `/skyknights:skiff`.
4. Use `/skyknights:debug` to record the detected control scheme.
5. Use `/skyknights:recover` if a manual reset is needed.

| Scenario                                          | Keyboard/mouse | Controller | Touch |
| ------------------------------------------------- | -------------: | ---------: | ----: |
| Pilot mounts the forward seat                     |            [ ] |        [ ] |   [ ] |
| Passenger mounts without taking control           |            [ ] |        [ ] |   [ ] |
| Ascend, descend, strafe, and reverse              |            [ ] |        [ ] |   [ ] |
| Land and dismount onto the dock                   |            [ ] |        [ ] |   [ ] |
| Player below Y=64 returns to last safe dock       |            [ ] |        [ ] |   [ ] |
| Skiff below Y=64 returns to its home dock         |            [ ] |        [ ] |   [ ] |
| Reload while mounted preserves usable state       |            [ ] |        [ ] |   [ ] |
| Disconnect/rejoin preserves player recovery state |            [ ] |        [ ] |   [ ] |

Record handling notes and any desired movement-speed changes here before
accepting ADR-003.

## Stable world-template proof

Create a dedicated Bedrock world using a void/empty preset, activate the stable
pack, and let the starter-island job finish. Then package a copy:

```powershell
npm run world-template -- --world "C:\path\to\the\world"
```

The command copies the world into `dist/world-template`, embeds the compiled
stable packs, writes the world pack references, and creates
`sky_knights_void_world.mctemplate`. It never edits the source world.

| Scenario                                       | Result |
| ---------------------------------------------- | -----: |
| Clean client imports the `.mctemplate`         |    [ ] |
| New world starts on the generated dock         |    [ ] |
| World reload retains the island marker         |    [ ] |
| Copied world retains pack bindings and state   |    [ ] |
| Two players spawn safely and can share a skiff |    [ ] |

## Experimental custom-dimension proof

The custom-dimension pack is intentionally separate from production:

```powershell
npm run local-deploy:experimental
```

Activate **Sky Knights Custom Dimension Proof** in a disposable world, then run:

```text
/skyknights:enter_sky_realm
/skyknights:leave_sky_realm
```

| Scenario                     | Result |
| ---------------------------- | -----: |
| First registration and entry |    [ ] |
| Exit to the Overworld        |    [ ] |
| `/reload` after registration |    [ ] |
| World close/reopen           |    [ ] |
| World copy                   |    [ ] |
| Pack upgrade                 |    [ ] |
| Second-player entry and exit |    [ ] |

Strategy A remains the release choice unless every custom-dimension row passes
and existing-world installation becomes a product requirement.

## Generation and persistence proof

The stable runtime stores one typed world document, one typed document per
player, and one typed document per ship. The world document contains a saved
seed, completed island identifiers, and a resumable generation checkpoint.

Run `/skyknights:island`, then close the world once after structure placement
and before the completion message. On reopen, confirm:

- the structure can be placed again without corrupting the island;
- the completion marker is written;
- `/skyknights:debug` reports no active job;
- content-log output has no watchdog or registry errors.

Record frame time and tick behavior on the weakest target device:

| Device  | Game build | Placement duration | Visible hitch | Content-log warning |
| ------- | ---------- | -----------------: | ------------: | ------------------: |
| Pending | 1.26.33    |                  — |           [ ] |                 [ ] |

## In-engine GameTest

Deploy the stable pack first, then:

```powershell
npm run local-deploy:gametest
```

Enable **Beta APIs**, activate **Sky Knights GameTests**, and run:

```text
/gametest run skyknights:skiff_has_pilot_and_passenger_seats
```

The test asserts that the custom entity loads, exposes the rideable component,
has exactly two seats, and uses seat zero as the controlling seat.
