# Hands-On Minecraft Validation Plan

This plan validates the platform and Phase 0 proofs inside Minecraft Bedrock.
The survival expedition is covered by the focused
[Phase 2 Playtest](PHASE_2_PLAYTEST.md). This document supplements
the automated checks in [PHASE_0_VALIDATION.md](PHASE_0_VALIDATION.md) and
should be run against disposable test worlds before a release candidate is
accepted.

## Test objectives

- Prove that a fresh world reliably creates a safe starter island.
- Validate skiff handling on keyboard/mouse, controller, and touch.
- Validate two-seat behavior with two real players.
- Prove player, ship, generation, and world state survive reloads.
- Validate the opt-in GameTest and custom-dimension profiles separately.
- Prove that a packaged world template imports and runs on a clean client.

## Prerequisites

- Minecraft Bedrock 1.26.33.
- A fresh disposable world for each profile.
- Cheats enabled.
- **Content Log File** and **Content Log GUI** enabled under
  **Settings → Creator**.
- Keyboard/mouse, a controller, and a touch-capable Bedrock device when
  available.
- A second player or client for multiplayer checks.
- A stopwatch and screenshot or screen-recording capability.

Do not use a valued survival world for this validation. The island regeneration
test deliberately replaces blocks at the starter-island coordinates.

## Build and deploy

From the repository root:

```powershell
npm ci
npm run verify
npm run local-deploy
```

Record the Git commit, Minecraft build, device, and generated package timestamp
before starting.

## Session 1: Stable pack, single player

Allow 45–60 minutes.

### 1. Clean install and first spawn

1. Create a fresh world with cheats enabled.
2. Activate **Sky Knights Behavior Pack** and confirm that its Resource Pack
   activates automatically.
3. Enter the world without running any commands.
4. Wait for starter-island generation and the Phase 0 messages.
5. Run:

   ```text
   /skyknights:debug
   ```

Expected:

- No manifest, script, registry, or texture errors appear in the Content Log.
- The authored island is centered around `0, 160, 0`.
- The player arrives on the safe dock without falling.
- Island generation causes no visible hitch longer than one second.
- Debug output reports schema `5`, islands `starter_island,ember_outpost`,
  versions `starter_island:v3,ember_outpost:v2`, `activeJob=none`, a saved
  seed, a dynamic-property byte count, and the detected control scheme.

Capture a screenshot of the island, the debug output, and the relevant Content
Log section.

### 2. Generation checkpoint and persistence

1. Run:

   ```text
   /skyknights:island
   ```

2. Confirm the structure is replaced cleanly and the Content Log records the
   placement checkpoint and completion.
3. Run `/skyknights:debug` and confirm `activeJob=none`.
4. Run `/skyknights:island` again, then save and quit while generation is in
   progress if the timing allows.
5. Reopen the world.

Expected:

- Repeated placement does not corrupt or duplicate the island.
- An interrupted job resumes safely or is already complete.
- Debug output returns to `activeJob=none`.
- No watchdog, registry, or unhandled script errors appear.

### 3. Keyboard/mouse skiff handling

1. Run:

   ```text
   /skyknights:skiff
   ```

2. Confirm the skiff appears ahead of the player at an accessible mounting
   height.
3. Enter the pilot seat and exercise:
   forward, reverse, strafe left/right, ascend, descend, turn, hover, landing,
   and dismount.
4. Fly around the island, approach the dock from multiple angles, land, and
   inspect the camera behavior.

Pass when:

- Every advertised movement direction works consistently.
- Inputs stop when released.
- Hovering and landing do not produce uncontrolled drift or oscillation.
- Dismounting places the player safely.
- Camera position and movement speed are usable for ordinary play.

Record handling notes and any recommended speed changes.

### 4. Player and skiff recovery

1. Move or fall below Y=64 while on foot.
2. Repeat while piloting the skiff.
3. Run:

   ```text
   /skyknights:recover
   ```

Expected:

- Automatic recovery occurs within roughly 0.5 seconds.
- The player returns to the saved dock with temporary resistance.
- A fallen skiff returns to its home dock.
- Recovery creates no duplicate skiff and loses no player inventory or state.
- Manual recovery remains usable when automatic recovery is not needed.

### 5. Reload and restart matrix

At each state below, test both `/reload` and a full save/quit/reopen:

| State | `/reload` | Reopen |
| --- | ---: | ---: |
| Standing on the dock | [ ] | [ ] |
| Seated in a stationary skiff | [ ] | [ ] |
| Skiff away from the island | [ ] | [ ] |
| Immediately after recovery | [ ] | [ ] |
| Immediately after island regeneration | [ ] | [ ] |

After every reload, confirm commands still work, the island remains intact,
the skiff is usable, and `/skyknights:debug` reports valid state.

## Session 2: Controller, touch, and multiplayer

Allow 45–75 minutes.

### 6. Controller

Repeat the full skiff-handling and recovery scenarios with a controller. Use
`/skyknights:debug` to confirm the reported control scheme.

Treat inaccessible ascend or descend controls as a blocker, even if horizontal
flight works. Record the controller model, platform, input mapping, dead-zone
behavior, and any camera conflicts.

### 7. Touch

Repeat the following matrix on a touch-capable Bedrock device:

| Scenario | Result |
| --- | ---: |
| Enter pilot seat | [ ] |
| Forward and reverse | [ ] |
| Strafe left and right | [ ] |
| Ascend and descend | [ ] |
| Turn and control camera | [ ] |
| Hover and land | [ ] |
| Dismount safely | [ ] |
| Automatic and manual recovery | [ ] |

If no suitable device is available, mark touch as **not tested** with the
reason; do not record it as passed.

### 8. Two-player seating and persistence

Test both seat-entry orders: pilot first, then passenger; passenger first, then
pilot.

Expected:

- The skiff accepts exactly two riders.
- Seat zero remains the controlling seat.
- The passenger cannot steal or override pilot control.
- The passenger follows turning, movement, landing, and recovery safely.
- A third rider cannot enter.
- Pilot and passenger can dismount without falling through the craft.
- Disconnecting and rejoining does not corrupt player or ship state.
- Both players respawn or recover at a safe location.

Repeat once with the host as pilot and once with the joining player as pilot.

## Session 3: Opt-in profiles and packaging

Allow 45–60 minutes.

### 9. In-engine GameTest

Deploy the stable pack, then:

```powershell
npm run local-deploy:gametest
```

In a separate Beta APIs test world, activate the stable pack and
**Sky Knights GameTests**, then run:

```text
/gametest run skyknights:skiff_has_pilot_and_passenger_seats
```

Pass when the GameTest reports success, the rideable component exposes exactly
two seats, seat zero is controlling, and the Content Log contains no test or
registry errors.

### 10. Experimental custom dimension

Deploy:

```powershell
npm run local-deploy:experimental
```

In a separate Beta APIs world, activate only the custom-dimension proof and run:

```text
/skyknights:enter_sky_realm
/skyknights:leave_sky_realm
```

Validate first registration, starter-island placement, return to the
Overworld, `/reload`, save/quit/reopen, world copy, and second-player entry and
exit.

A failure here confirms that the experimental dimension is not ready; it does
not block the stable Strategy A release.

### 11. World-template import

Close Minecraft before copying the source world, then run:

```powershell
npm run world-template -- --world "C:\path\to\the\world"
```

Import `dist/world-template/sky_knights_void_world.mctemplate` on a clean
client.

Pass when:

- Import succeeds without manual file repair.
- A world created from the template has both packs bound and active.
- The island, spawn, commands, skiff flight, and recovery work.
- A copied world retains pack bindings and saved state.
- Two players can spawn safely and share a skiff.

Use the `0.1.0` to `0.2.0` upgrade session in
`docs/DOCKYARD_REFIT_COMBAT_TEST_PLAN.md` for the pack-upgrade row;
reinstalling the same version is not a meaningful upgrade test.

## Release acceptance criteria

The Phase 0 candidate is accepted only when:

- Stable single-player generation, flight, recovery, and persistence pass.
- Keyboard/mouse and controller handling are comfortable and complete.
- Touch passes or is explicitly excluded from the candidate with rationale.
- Two-player seating, recovery, disconnect, and rejoin pass.
- The in-engine GameTest passes.
- A clean client imports and runs the `.mctemplate`.
- Content logs contain no registry errors, unhandled exceptions, or watchdog
  termination.
- Any custom-dimension failures are documented and Strategy A remains the
  release architecture.

## Evidence log

Use one row per scenario or defect:

| ID | Date | Git build | Device/game build | Input | Players | Result | Evidence | Issue |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| HV-001 | | | | | | | | |

Attach screenshots, recordings, and Content Log excerpts using the evidence ID.
