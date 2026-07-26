# Dockyard Refit and Airship Combat Test Plan

Use this plan to validate the `0.2.0` Dockyard Refit and Airship Combat slice
in Minecraft Bedrock. It covers a fresh Survival run, an upgraded `0.1.0`
world, every refit effect, the Ashwing Raider encounter, persistence,
recovery, multiplayer permissions, and input methods.

## Build under test

Record these before testing:

- Add-on commit: `________________`
- Add-on version: `0.2.0`
- Minecraft version: `________________`
- Device/platform: `________________`
- Input: keyboard/mouse, controller, or touch
- World name and seed: `________________`
- Fresh world or upgraded world: `________________`

Build and deploy the exact files under test:

```powershell
npm ci
npm run verify
npm run local-deploy
```

Expected:

- lint, TypeScript, 25 or more host tests, packaging, and profile builds pass;
- `npm audit` reports no known vulnerabilities;
- the Behavior Pack and Resource Pack both show version `0.2.0`;
- no red error appears in the Minecraft Content Log.

For in-engine automation, also run:

```powershell
npm run local-deploy:gametest
```

Activate **Sky Knights GameTests** beside the normal Behavior Pack in a
separate test world and run:

```text
/gametest runset skyknights
```

Expected GameTests:

- starter skiff has two seats;
- Skycutter has four seats and 18 standard cargo slots;
- Expanded Cargo Hold changes the Skycutter to 27 cargo slots;
- Ashwing Raider has 120 hull.

## Content Log gate

Before each session:

1. Enable **Content Log File** and **Content Log GUI** in Creator settings.
2. close and restart Minecraft after deploying entity, item, manifest, or
   render-controller changes;
3. activate both Sky Knights packs;
4. enter the world and wait 15 seconds;
5. run `/skyknights:debug`.

Pass when:

- the command is recognized;
- the report shows `schema=4`;
- `raiderEncounter` is `dormant`, `active`, or `defeated`;
- all required entity/item registry validation passes in the Content Log;
- there are no JSON, Molang, texture, custom component, or Script API errors.

Do not continue a session with a red pack-load error. Capture the first error,
the lines immediately around it, and the build commit.

## Session A — upgrade an existing world

Use a backup copy of a world previously played with `0.1.0`.

1. Confirm the old world contains its starter island, Dockmaster, and owned
   skiff or Skycutter.
2. Exit the world.
3. deploy and activate `0.2.0`, then reopen it;
4. wait for island upgrade jobs to finish;
5. run `/skyknights:debug`.

Pass when:

- the starter island remains solid and does not duplicate;
- Dockmaster Elian appears at the starter dock;
- the existing owned ship is still present or can be recalled;
- the existing Skycutter retains its original four-module loadout;
- world/player/ship data migrate to schemas `4`, `3`, and `3`;
- a formerly completed Crystal-to-Cutter player receives the
  `craft_combat_refit` objective;
- Ember Outpost upgrades to `v4` and Frostspire upgrades to `v2` without
  destroying unrelated player blocks away from regenerated structures;
- reloading again does not duplicate islands, loot, the Dockmaster, or ships.

## Session B — fresh Survival progression

Create a new Survival world with cheats enabled only for diagnostics.

1. Wait for Verdant Isle, Ember Outpost, and Frostspire generation to finish.
2. Walk the full starter island, including its outer grass and dock surface.
3. Complete the Crystal-to-Cutter progression:
   - craft and assemble the starter skiff;
   - raid Ember Outpost;
   - return the Aether Crystal;
   - craft and assemble the Skycutter;
   - raid Frostspire;
   - return at least one Froststeel Ingot.
4. Check the refreshed guaranteed loot:
   - Ember chest has an Aether Crystal, 24 iron, and 8 redstone;
   - Frostspire chest has 16 Froststeel Ingots.

Pass when:

- no normal walking route exposes an unintended hole in the starter island;
- all objectives advance without a developer command;
- the Froststeel delivery changes the objective to `craft_combat_refit`;
- enough guaranteed Froststeel and redstone exist to craft every advanced
  module and the cannon.

## Session C — recipes and inventory

Craft:

- Armored Hull;
- Frostfire Engine;
- Expanded Cargo Hold;
- Aether Cannon;
- at least 16 Aether Charges.

Pass when:

- every recipe appears and produces the named item;
- one coal plus one iron produces eight Aether Charges;
- crafting the Aether Cannon advances the objective to
  `install_combat_refit`;
- all item names and icons render correctly, with no missing-texture tile.

Retain a copy of each original module so both upgrade and downgrade paths can
be tested.

## Session D — dock-only refit

### Refit access and ownership

1. Move the owned Skycutter more than 18 blocks from the starter dock.
2. interact with Dockmaster Elian and choose **Refit Docked Skycutter**;
3. recall the ship, then open the refit again;
4. if testing multiplayer, have a non-owner try the same ship.

Pass when:

- an undocked ship cannot be modified;
- the recalled ship can be modified;
- a non-owner cannot modify it;
- the menu reports the installed Hull, Engine, Cargo, and Utility modules.

### Atomic swap

For each slot, install its advanced module and then reinstall the original:

| Slot | Original | Advanced |
| --- | --- | --- |
| Hull | Reinforced Hull | Armored Hull |
| Engine | Aether Engine | Frostfire Engine |
| Cargo | Cargo Hold | Expanded Cargo Hold |
| Utility | Navigator Module | Aether Cannon |

Pass each swap when:

- exactly one selected module is consumed;
- exactly one removed module is returned;
- canceling a form changes nothing;
- selecting the already installed module changes nothing;
- trying to install an unowned module changes nothing;
- `/skyknights:debug` reports the new module identifier.

Fill the player inventory before one swap. Pass when the operation either uses
the slot freed by consuming the replacement or refuses cleanly; no module may
be deleted or duplicated.

## Session E — module effects

### Armored Hull

1. Record Skycutter maximum hull with Reinforced Hull.
2. install Armored Hull and record it again;
3. damage the ship by a repeatable amount.

Pass when:

- maximum hull changes from 120 to 180;
- armor plating becomes visible;
- incoming damage is reduced by 20%;
- reinstalling Reinforced Hull returns maximum hull to 120 and hides the
  plating.

### Frostfire Engine

1. time a straight flight over the same route with the Aether Engine;
2. repeat with Frostfire Engine;
3. fly beyond the starter ship's range boundary.

Pass when:

- Frostfire is visibly faster;
- it still grants long-range travel;
- the ship remains steerable and does not drift after dismounting.

### Expanded Cargo Hold

1. install Expanded Cargo Hold;
2. crouch-interact with the Skycutter;
3. put a disposable item in slot 27;
4. try to reinstall the standard Cargo Hold;
5. empty slots 19–27 and retry.

Pass when:

- the expanded inventory contains 27 slots;
- expanded cargo geometry is visible;
- downgrade is blocked while any high slot is occupied;
- after those slots are empty, downgrade succeeds and exposes 18 slots;
- no cargo disappears.

### Aether Cannon

Install the Aether Cannon.

Pass when:

- cannon geometry is visible;
- the objective becomes `defeat_sky_raider`;
- one reusable Cannon Control is issued to the player or ship cargo;
- reinstalling or reloading does not issue duplicate controls.

## Session F — cannon negative cases

Use the Cannon Control in each state:

1. while standing off the ship;
2. aboard a Skycutter without an Aether Cannon;
3. aboard a cannon-equipped ship with no Aether Charges;
4. as a non-owner gunner while the owner is absent;
5. as a non-owner gunner while the owner is aboard;
6. fire repeatedly faster than once per second.

Pass when:

- cases 1–4 do not fire or consume ammunition and show a useful action-bar
  message;
- case 5 fires and consumes exactly one Aether Charge;
- the one-second cooldown prevents rapid fire and duplicate ammo consumption;
- the Cannon Control itself is never consumed.

## Session G — Ashwing Raider encounter

1. Put Aether Charges in ship cargo.
2. board the cannon-equipped Skycutter;
3. fly more than 60 blocks from the starter dock;
4. wait up to 10 seconds.

Pass when:

- one Ashwing Raider appears ahead and above the launch path;
- the world announces the sighting;
- it appears as a dark hostile airship with visible cannons;
- it approaches or targets the ship/player and fires arrows;
- a second Raider does not spawn while the first is active.

Aim at the Raider and fire.

Pass when:

- a visible shot and firing sound occur;
- each clear hit deals 24 direct hull damage;
- misses still consume one charge;
- `/skyknights:debug` increments shots and hits;
- the Raider can be defeated in five clean hits from full 120 hull;
- the encounter becomes `defeated` and does not respawn normally.

If encounter setup must be repeated, use the developer-only reset:

```text
/skyknights:raider
```

## Session H — reward and Shield Projector

1. Confirm the Raider drops or awards one Raider Core to each eligible nearby
   participant.
2. return to Dockmaster Elian with the core in player inventory;
3. repeat on another test run with the core in docked ship cargo;
4. choose **Return Raider Core**.

Pass when:

- either storage location is accepted;
- exactly one Raider Core is consumed;
- one Shield Projector is awarded;
- the objective becomes `combat_complete`;
- a full inventory causes the projector to drop safely nearby.

Install the Shield Projector.

Pass when:

- shield projector pylons become visible and cannon geometry disappears;
- incoming ship damage is reduced by 45%;
- with Armored Hull also installed, damage is approximately 44% of the
  unmodified amount;
- the Shield Projector can be exchanged back for the cannon with both items
  preserved.

## Session I — reload and recovery

Test reloads at four points:

1. after advanced modules are installed;
2. while the Ashwing Raider is active;
3. after the Raider is defeated but before returning the core;
4. after `combat_complete`.

For each point:

1. save and quit to the title screen;
2. reopen the world and wait 15 seconds;
3. run `/skyknights:debug`;
4. if appropriate, also run `/reload`.

Pass when:

- the module loadout and visible geometry return correctly;
- maximum hull and cargo size match the installed modules;
- an active missing Raider recovers once when a participant returns nearby;
- an active Raider is never duplicated;
- a defeated Raider stays defeated;
- objectives, Raider Core, Shield Projector, and combat counters persist;
- Dockmaster Elian remains available;
- ship recall and one-Kit reconstruction preserve the saved module blueprint;
- reconstruction does not restore lost cargo or create duplicate module
  items.

## Session J — multiplayer

Use at least two players.

1. Player A owns the Skycutter and installs the cannon.
2. Player B boards a passenger/gunner seat.
3. Player B fires while A is aboard.
4. Player A dismounts and B tries again.
5. Both participate in the Raider fight.
6. attempt a Dockmaster refit as B.

Pass when:

- A retains steering control;
- B may fire only while A is aboard;
- both nearby eligible participants receive clear encounter completion and
  reward handling;
- B cannot refit or take ownership of A's ship;
- only one shared Raider exists and its defeat state is consistent for all
  players.

## Session K — input and camera

Repeat mounting, steering, refit forms, aiming, and firing with every supported
input method.

Record:

| Input | Mount | Steer | Refit UI | Aim/fire | Pass |
| --- | --- | --- | --- | --- | --- |
| Keyboard/mouse | [ ] | [ ] | [ ] | [ ] | [ ] |
| Controller | [ ] | [ ] | [ ] | [ ] | [ ] |
| Touch | [ ] | [ ] | [ ] | [ ] | [ ] |

Also test first-person and third-person camera. Pass when the ship, cannon
visual, projectile, and Raider do not block aiming or cause severe camera
clipping.

## Acceptance checklist

The slice is accepted only when:

- [ ] `npm run verify` passes;
- [ ] all JSON and Content Log checks are clean;
- [ ] fresh and upgraded worlds both work;
- [ ] every refit is owner-only, dock-only, atomic, and persistent;
- [ ] module visuals and gameplay effects match the selected loadout;
- [ ] expanded-cargo downgrade cannot delete inventory;
- [ ] cannon permissions, ammo, aiming, damage, and cooldown work;
- [ ] exactly one recoverable Raider encounter runs per world;
- [ ] the Raider Core and Shield Projector close the progression loop;
- [ ] reload, recall, reconstruction, and multiplayer regressions pass;
- [ ] supported input methods are usable.

For any failure, record the build commit, world state, exact reproduction
steps, expected/actual result, Content Log excerpt, and a screenshot or short
video.
