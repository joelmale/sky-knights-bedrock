# Crystal-to-Cutter Hands-On Test Plan

This plan validates the progression slice from the existing starter skiff
through the four-seat Skycutter and Frostspire cargo return. Run it in a
disposable copy of the playtest world first because island content upgrades
replace the authored structure volumes.

## Test record

Record these details before testing:

| Field | Value |
| --- | --- |
| Minecraft version | |
| Add-on commit/build | |
| Input device | Keyboard / controller / touch |
| Player count | |
| World | Fresh / upgraded copy |
| Content Log clean at start | Yes / No |

For every failure, capture the exact step, expected and actual result, a
screenshot or video, and the relevant Content Log lines.

## 1. Build, deploy, and reload

1. Leave the test world.
2. From the project directory run:

   ```powershell
   npm ci
   npm run verify
   npm run local-deploy -- --once
   ```

3. Reopen Minecraft, confirm both Sky Knights packs are active, and reopen the
   world. Restart Minecraft instead of relying on `/reload` for the first pass
   because entity definitions and structures changed.
4. Wait for the island-generation messages to finish.
5. Run `/skyknights:debug`.

Pass when:

- the Content Log has no pack, script, entity, recipe, texture, geometry, or
  structure errors;
- debug reports world schema `3`, `activeJob=none`,
  `starter_island:v3`, `ember_outpost:v3`, and `frostspire:v1`;
- the starter island is a continuous solid mass with no ordinary walking
  surface gaps;
- Ember Outpost is present near `X=84, Z=0`;
- Frostspire is present near `X=253, Z=0`.

## 2. Dockmaster self-healing

1. Confirm Dockmaster Elian is standing at the starter dock.
2. Save, quit, and reopen the world.
3. Confirm Elian is still present and opens the shipyard form.
4. In a disposable Creative copy, remove Elian with:

   ```text
   /kill @e[type=skyknights:dockmaster]
   ```

5. Stay near the dock for up to 15 seconds.

Pass when exactly one Dockmaster reappears, remains after another save/reopen,
and `/skyknights:debug` reports `dockmastersHere=1`.

## 3. Existing-world migration

Use an older world containing a previously assembled skiff.

1. Reopen the upgraded world and run `/skyknights:debug`.
2. Board and fly the old skiff.
3. Speak with the Dockmaster.

Pass when:

- old player and ship documents migrate without a Content Log error;
- the skiff remains controllable;
- debug shows the current tutorial objective and an owned `skiff`;
- the Dockmaster offers the next action instead of requiring the skiff to be
  assembled again.

## 4. Return the Aether Crystal

Use the guaranteed crystal from the Ember Outpost chest. If that chest was
looted in an earlier disposable test, use a fresh world copy.

1. Put one Aether Crystal in the owning player's inventory.
2. Open the Dockmaster shipyard and choose **Return Aether Crystal**.
3. Reopen the shipyard and repeat the attempt.
4. Save, quit, and reopen the world.

Pass when:

- exactly one crystal is consumed;
- exactly one Aether Engine is granted;
- the Skycutter blueprint unlocks and the objective becomes
  `assemble_skycutter`;
- the return action cannot grant a second free engine;
- the unlock and objective survive reload.

## 5. Craft the four modules

Craft:

- one Reinforced Hull;
- one Aether Engine, supplied by the Dockmaster;
- one Cargo Hold;
- one Navigator Module.

The Ember Outpost v3 chest guarantees enough supplemental iron, redstone, and
emeralds to close this progression step.

Pass when:

- all recipes except the one-of-a-kind engine appear and craft;
- the shipyard displays `1/1` for Hull, Engine, Cargo, and Utility;
- assembly with a missing module fails without consuming any modules.

## 6. Assemble and launch the Skycutter

1. Recall or land the existing skiff at the starter dock.
2. Choose **Assemble Skycutter**.
3. Observe the launch berth before boarding.
4. Board with ordinary Interact/right-click and fly away from the dock.

Pass when:

- all four modules are consumed atomically;
- the old skiff is replaced, not duplicated;
- one Skycutter appears at an accessible height;
- the model reads as a larger deck-and-cargo ship;
- it mounts, turns, climbs, descends, lands, and dismounts correctly;
- `/skyknights:debug` reports an owned `skycutter`;
- reloading at the dock does not duplicate or lose the ship.

## 7. Seats, pilot ownership, and cargo

1. Have the owner board first.
2. Fill the other three seats with players, one at a time.
3. Confirm only seat 0 controls the ship.
4. Dismount everyone.
5. Crouch-interact with the Skycutter and place named test items in the first,
   middle, and last cargo slots.
6. Have a non-owner try to board first and try to open the cargo.
7. Save, quit, reopen, and inspect the cargo again.

Pass when:

- four players can ride without falling through the deck;
- the owner controls the ship and passengers cannot override the pilot;
- a non-owner is removed from the pilot seat unless the owner boarded first;
- the owner can use all 18 cargo slots;
- cargo contents and slot positions survive reload;
- another player cannot take over owner-restricted cargo.

## 8. Travel-range gate

Run this in a disposable copy so the developer shortcut does not alter the
main progression record.

1. Spawn a starter skiff with `/skyknights:skiff`.
2. Fly east and watch for the warning near 130 horizontal blocks from its home
   dock.
3. Continue past 150 blocks.
4. Repeat the same route in the assembled Skycutter.

Pass when:

- the starter craft warns before the range boundary and is recovered to its
  home dock after crossing it;
- the rider receives a clear Aether Engine requirement message;
- the Skycutter crosses the boundary and reaches Frostspire without being
  recalled.

## 9. Frostspire expedition and cargo return

1. Fly the Skycutter east to Frostspire near `X=253, Z=0`.
2. Land on or beside its spruce dock.
3. Defeat the Frostspire Warden.
4. Open the ruin chest and confirm it includes 16 Froststeel Ingots.
5. Put at least one Froststeel Ingot in the Skycutter cargo hold.
6. Return to the starter dock.
7. Open the Dockmaster form and choose **Deliver Froststeel**.

Pass when:

- the discovery message appears once;
- the objective changes to `return_frost_cargo`;
- the Froststeel remains in cargo throughout the return flight;
- the Dockmaster accepts one ingot directly from docked cargo;
- the objective becomes `craft_combat_refit`;
- the player receives two Repair Kits.

## 10. Damage, repair, destruction, and reconstruction

Use a disposable copy.

1. Damage the Skycutter without destroying it.
2. Attempt **Repair Docked Ship** while away from the starter dock.
3. Recall it, then repair it with one Repair Kit.
4. Put expendable items in cargo and destroy the Skycutter.
5. Reopen the Dockmaster form and choose **Reconstruct Ship**.

Pass when:

- damage feedback reports current and maximum hull integrity;
- away-from-dock repair is refused without consuming a kit;
- docked repair consumes one kit and restores the full 120 hull;
- destruction marks the ship unavailable instead of silently creating a
  duplicate;
- reconstruction consumes one kit and restores the same four module slots;
- lost cargo is not duplicated and the loss is stated clearly.

## 11. Recall, void recovery, and persistence matrix

At each row, test both `/reload` and save/quit/reopen:

| State | `/reload` | Reopen |
| --- | ---: | ---: |
| Blueprint unlocked, modules not yet crafted | [ ] | [ ] |
| Skycutter assembled at the home dock | [ ] | [ ] |
| Skycutter parked at Ember Outpost | [ ] | [ ] |
| Skycutter parked at Frostspire with cargo | [ ] | [ ] |
| Skycutter damaged | [ ] | [ ] |
| Skycutter destroyed and awaiting reconstruction | [ ] | [ ] |
| Expedition complete | [ ] | [ ] |

Also fly or push both the player and ship below `Y=64`.

Pass when player and ship recover safely, ownership and tutorial state persist,
cargo is neither erased nor duplicated except after documented destruction,
and **Recall / Dock Ship** returns the existing ship rather than spawning a
replacement.

## 12. In-engine GameTest

Deploy and activate the opt-in GameTest pack alongside the normal development
packs:

```powershell
npm run local-deploy:gametest
```

With the required Creator/GameTest experiment enabled, run:

```text
/gametest run skyknights:skiff_has_pilot_and_passenger_seats
/gametest run skyknights:skycutter_has_four_seats_and_cargo
```

Pass when both required tests succeed and the Skycutter test reports four
seats, controlling seat 0, and 18 inventory slots.

## Acceptance

The slice is accepted when a fresh Survival player can complete this path
without developer commands:

```text
starter skiff
  -> Ember Outpost
  -> Aether Crystal
  -> four Skycutter modules
  -> four-seat cargo Skycutter
  -> Frostspire
  -> Froststeel cargo return
  -> repair/recovery-ready owned ship
```

Do not accept the slice with a Content Log error, duplicated ship, missing
Dockmaster, ownership bypass, progression soft-lock, lost persistence, or an
unreachable island.
