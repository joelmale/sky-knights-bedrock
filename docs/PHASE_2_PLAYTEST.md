# Phase 2 Survival Expedition Playtest

This test validates the command-free gray-box loop and the solid-island
migration in Minecraft Bedrock. Use a disposable copy of the existing test
world because the migration intentionally replaces blocks in the starter
island structure volume.

## Build and deploy

```powershell
npm ci
npm run verify
npm run local-deploy -- --once
```

Close and reopen the test world after deployment so the new entities, items,
recipes, structures, and world migration all reload.

## Existing-world island upgrade

1. Open the world that previously showed striped terrain and gaps.
2. Wait for both generation jobs to finish.
3. Run `/skyknights:debug`.
4. Walk the complete grass surface and dock perimeter, then dig a short
   vertical test shaft in a disposable area.

Pass when:

- The main island is a continuous, solid tapered mass rather than separated
  lines.
- There are no holes through the ordinary walking surface.
- The player starts and recovers safely at the dock.
- Debug reports schema `5`, `activeJob=none`, `starter_island:v4`,
  `ember_outpost:v4`, and `frostspire:v2`.
- The Content Log contains no script, registry, structure, recipe, or texture
  errors.

If the old world was already open during deployment, leave and reopen it before
judging the migration.

## Fresh survival loop

Use Survival mode and do not use `/give` or `/skyknights:skiff`.

1. Confirm the workshop has two visible oak trees (8 logs), 12 exposed iron
   ore, 8 exposed coal ore, abundant stone, a crafting table, and a furnace.
2. Harvest logs and craft planks, sticks, a wooden pickaxe, then a stone
   pickaxe. Use the placed crafting table and furnace; do not need to dismantle
   the dock or workshop.
3. Mine at least seven iron ore and three coal (two for the ship recipes and
   one as furnace fuel); the exposed seams provide a deliberate buffer.
4. Smelt seven iron ingots.
5. Craft:
   - one Ship Core;
   - two Canvas Bundles;
   - one Thruster Module.
6. Right-click or use **Interact** on Dockmaster Elian.
7. Confirm the shipyard lists the correct inventory counts.
8. Choose **Assemble Starter Skiff**.

Pass when:

- Every required material is obtainable on the home island.
- The visible resource budget and placed workstations support the route without
  consuming dock blocks or using commands.
- All three recipes are visible and craft successfully.
- Assembly fails cleanly when any component is missing.
- Successful assembly consumes exactly the listed components.
- One skiff appears at an accessible height beside the dock.
- A second assembly is blocked while the launch berth is occupied.
- The player can mount with Interact and the skiff retains two usable seats.

## Ember Outpost expedition

1. Ask the Dockmaster for the travel briefing.
2. Fly east toward `X=84, Z=0`.
3. Land on the blackstone dock.
4. Confirm the discovery message appears only once.
5. Defeat the Ember Outpost Guardian.
6. Open the ruin chest.

Pass when:

- The outpost is a solid floating landmass with a visible dock and ruin.
- The guardian spawns once and ordinary combat works.
- The chest always contains one Aether Crystal plus the support loot.
- No command is required to complete the trip.
- Flying back to the home dock remains possible after looting.

## Persistence and recovery matrix

Test both `/reload` and save/quit/reopen at each point:

| State                            | `/reload` | Reopen |
| -------------------------------- | --------: | -----: |
| Before crafting ship parts       |       [ ] |    [ ] |
| With some ship parts crafted     |       [ ] |    [ ] |
| Immediately after skiff assembly |       [ ] |    [ ] |
| Parked at Ember Outpost          |       [ ] |    [ ] |
| After taking the Aether Crystal  |       [ ] |    [ ] |
| After returning home             |       [ ] |    [ ] |

Also move the player and skiff below Y=64. Both must recover without deleting
inventory, duplicating a ship, resetting island content, or refilling a looted
chest.

## Multiplayer spot check

1. Have player one gather and assemble the skiff.
2. Have player two enter the passenger seat.
3. Fly to the outpost, fight the guardian, and return.
4. Repeat once with player two piloting.

Pass when both players travel safely, the passenger cannot override the pilot,
only one guaranteed crystal exists, and reconnecting does not corrupt either
player or the skiff.

## Acceptance

The slice is accepted when a fresh Survival player can complete:

```text
wood -> tools -> ore -> ship parts -> skiff -> outpost -> guardian -> crystal -> return
```

Record failures with the game build, input device, player count, reproduction
steps, screenshot or recording, and relevant Content Log excerpt.

Continue with the
[Crystal-to-Cutter hands-on plan](CRYSTAL_TO_CUTTER_TEST_PLAN.md) to validate
the Skycutter, cargo, ownership, range gate, Frostspire, repair, and
reconstruction systems.
