# Procedural Archipelago Hands-On Test Plan

> Build under test: `0.3.8`
>
> Automated status is not Minecraft acceptance. Record the exact commit,
> Minecraft version, world type, device, input method, and Content Log result.
>
> The `0.3.5` attempt at this plan was run on a normal Infinite world with the
> development packs, so its terrain observations did not apply. Confirm the
> `below=` line in Session A before recording anything else.

## Preparation

Run:

```powershell
npm ci
npm run verify
npm run world-template:void
npm run world-template:install
```

`npm ci` is needed only after a fresh clone or dependency/lockfile change.

`world-template:install` extracts the built template into Minecraft's
`world_templates` folder. Double-clicking the `.mctemplate` does nothing unless
Windows has a handler registered for the extension, which the GDK Bedrock
install does not. **Restart Minecraft afterwards** — templates are enumerated at
startup — then create a new world from **Sky Knights: Void Realm** under
templates. The stable packs are already embedded; do not activate a second
standalone copy. A normal Overworld is useful only for the compatibility
session and will retain vanilla terrain.

Enable cheats, **Content Log File**, and **Content Log GUI**. Activate the Sky
Knights Behavior Pack and its Resource Pack.

## Session A — bootstrap, world type, and version

1. Create a fresh world **from the imported template**, not a normal world with
   the packs enabled, and enter it without running a Sky Knights command.
2. Wait for automatic arrival at the starter dock.
3. Run `/skyknights:debug` and read the `below=` line first.
4. Walk the island and count the ore that breaks the grass surface.

Pass when:

- debug reports `Sky Knights debug v0.3.8`;
- debug reports `below=void`; stop and restart the session on a template world
  if it reports vanilla terrain;
- starter island, Ember Outpost, and Frostspire complete automatically;
- `activeJob=none` after bootstrap settles;
- debug includes the bounded solo-island and continent counts;
- no missing-structure, registry, ticking-area, watchdog, or script error
  appears in the Content Log.

## Session A2 — starter resource route

The `0.3.5` playtest reached the Ship Core recipe with two iron. `0.3.6` places
18 iron, 8 coal, 16 logs, and a ten-block boulder, all reachable from the
walkable surface.

1. Without flying or using a command, locate the visible ore.
2. Mine the boulder, craft a wooden then a stone pickaxe, and mine iron.
3. Smelt and craft one Ship Core (4 ingots) and one Thruster Module (3 ingots).

Pass when:

- at least four iron and two coal outcrops are visible standing on the grass;
- digging straight down under an outcrop yields more of the same ore;
- the ten-block boulder is reachable and mineable;
- four oak trees are standing;
- both parts are crafted with iron left over, and no ore requires leaving the
  island surface.

Record the iron mined before the first Ship Core, and any resource the route
still runs short of.

## Session B — nearby lazy generation

1. Remain near the starter island for two minutes.
2. Run `/skyknights:debug` every 30 seconds and record the ambient count.
3. Fly toward the next coordinate reported by debug, matching its altitude
   instead of holding one fixed Y.
4. Observe islands appearing ahead of the player.

Pass when:

- the ambient count increases without a developer generation command;
- only one `a2_...` job is active at a time;
- new islands remain outside the authored central realm;
- no island stamps directly around a player or occupied craft;
- entering a queued target before placement preserves the entity and skips that
  candidate without blocking later islands;
- placement does not visibly freeze controls for more than a brief frame;
- islands do not intersect one another.

Record count after two minutes, longest visible hitch, and approximate client
FPS before and during placement.

## Session C — family, tier, altitude, and rare-variant variety

Visit the four broad planner quadrants across the deep, low, mid, high, and
crown altitude bands. The exact centers vary by world seed, but the reference
layout places family clusters roughly around:

| Quadrant               | Expected dominant family |
| ---------------------- | ------------------------ |
| northwest (`-X`, `-Z`) | Verdant                  |
| northeast (`+X`, `-Z`) | Desert                   |
| southwest (`-X`, `+Z`) | Tundra                   |
| southeast (`+X`, `+Z`) | Volcanic                 |

Sample at least ten solo islands in each quadrant between about 1,200 and 2,000
blocks from the origin. Visit at least one islet, Standard island, crag, and
landmark. Then travel to one of the six continent sites on the outer ring and
let its complete 21-part job finish.

Pass when:

- each quadrant is visually dominated by its expected palette;
- all four palettes are readily distinguishable at normal flight distance;
- island origins visibly span multiple altitude bands rather than one shelf;
- islets, Standard islands, crags, and landmarks have distinct silhouettes;
- one continent reads as a rounded, continuous landmass with no open component
  seams, contains a central massif, at least two lakes, a chasm, and a bridge,
  and does not visibly place all 21 parts in one frozen frame;
- volcanic burn islands are rare, an ember island keeps its oaks isolated from
  eternal netherrack fire, and a reactive pyre eventually consumes its bounded
  grove without restamping it;
- no continent contains a burn variant;
- no ambient island contains a Dockmaster, progression chest, custom entity,
  Aether Core, or Relic Shard.

These are visual biome families, not true Bedrock biome assignments. Weather,
sky color, and the biome readout are not expected to change in this slice.

## Session D — reload and duplicate safety

1. While exploring new space, watch debug until an `a2_...` job is active.
2. Close the world during or immediately after visible placement.
3. Reopen the same world.
4. Return to that island and run debug.
5. Repeat the close/reopen after at least 25 ambient islands exist.
6. At a continent site, close once during the 21-part placement and reopen.

Pass when:

- the active job completes or safely retries;
- the island is not duplicated, shifted, or partially overlaid;
- the continent resumes after its persisted part cursor and finishes without
  erasing or rejecting the components already placed;
- the ambient count never decreases or double-increments for one ID;
- no ticking area named `skyknights_generation_*` remains stuck;
- dynamic property bytes remain below the configured world-document limit.

## Session E — occupied-volume protection

This is a cheats-enabled safety test.

1. Run `/skyknights:archipelago_pause`.
2. Wait for any already active job to finish, then run debug and confirm
   `paused=true activeJob=none`.
3. Note the reported next ambient origin.
4. Teleport far enough above and beside the reported bounds to load its chunks
   without entering that tier's target volume.
5. Use `/setblock <origin-x> <origin-y> <origin-z> gold_block` to place a
   conspicuous block inside the target volume.
6. Run `/skyknights:recover` to leave the candidate's reported player-clearance
   area.
7. Run `/skyknights:archipelago_resume`.
8. Wait for the planner to process the location.
9. Return to the target and inspect the block and Content Log.

Pass when:

- the player block remains;
- no island stamps over the occupied volume;
- the log reports that the ambient island was skipped to preserve an occupied
  volume;
- generation proceeds to other locations afterward.

Always run the resume command before leaving the test world. The pause is
in-memory and also clears on a full script/world reload, but do not rely on that
as normal cleanup.

## Session F — normal-Overworld compatibility

1. Create a separate normal Infinite world with the same pack.
2. Complete automatic bootstrap and fly below the islands.
3. Explore far enough to trigger ambient generation.

Pass when:

- vanilla terrain remains untouched;
- ambient islands appear only where their complete target volume was air;
- mountains or player builds occupying a target cause a safe skip;
- the test confirms compatibility, not sky-only presentation.

## Session G — exploration and cap

On the strongest available test device, explore continuously through new
planner cells for at least 30 minutes. On the weakest target device, repeat for
at least 10 minutes.

Record:

- islands generated;
- average and worst placement hitch;
- Content Log warnings;
- save size before and after;
- dynamic-property byte count;
- memory or disconnect symptoms;
- multiplayer observations if a second player explores another quadrant.

Pass when generation remains responsive, restart-safe, and below the 224-solo
and two-continent lifetime caps. Reaching either cap is not required for the
first hands-on pass.

## Acceptance record

| Session                        | Result | Evidence/notes |
| ------------------------------ | ------ | -------------- |
| A — bootstrap/world type       | [ ]    |                |
| A2 — starter resource route    | [ ]    |                |
| B — lazy generation            | [ ]    |                |
| C — family/tier/altitude variety | [ ]    |                |
| D — reload safety              | [ ]    |                |
| E — occupied volume            | [ ]    |                |
| F — normal world compatibility | [ ]    |                |
| G — performance/cap            | [ ]    |                |

The slice is ready for broader play only when Sessions A–F pass on a fresh void
world and the Content Log is clean. Session G supplies the measurements needed
to adjust density, per-tier radii, and the two lifetime caps.

Sessions A and A2 are the gate for everything after them: a wrong world type
invalidates the terrain observations, and a starter route that cannot reach the
first ship invalidates the progression ones.
