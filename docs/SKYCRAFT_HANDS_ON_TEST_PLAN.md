# Player-Built Skycraft Hands-On Test Plan

> Build under test: `0.3.5`
>
> Scope: integrated Skycraft prototype and every activation gate defined by
> [`SKYCRAFT_TECHNOLOGY_ROADMAP.md`](SKYCRAFT_TECHNOLOGY_ROADMAP.md).
>
> Automated checks do not replace this plan. Do not mark a certification cap
> or physical-cargo path ready from host tests alone.

## Build and deploy

From the repository root:

```powershell
npm ci
npm run verify
node tools/project.mjs local-deploy --once
```

`npm ci` is required on a new clone or after dependency changes. It is not
required before every play session when `node_modules` already matches
`package-lock.json`.

For an importable package instead:

```powershell
npm run mcaddon:production
```

Confirm the behavior-pack description or `/skyknights:debug` reports `0.3.5`.
For script-only local-deploy changes, `/reload` may reload the pack, but use a
full world exit/reopen for entity, block, recipe, resource-pack, manifest, or
recovery testing.

## Evidence header

Record this once per session:

| Field                 | Result |
| --------------------- | ------ |
| Date/time             |        |
| Git commit            |        |
| `.mcaddon` filename   |        |
| Minecraft version     |        |
| Host/client or BDS    |        |
| Input method          |        |
| Device/OS             |        |
| New or existing world |        |
| Players connected     |        |
| Content Log clean     |        |

Save screenshots of the Helm report, launched proxy, restored dock build, and
any failure. Copy exact Content Log errors; do not paraphrase them.

## Activation modes

Normal playtesting exposes only the Apprentice certification until later caps
have performance evidence. To expose every prototype tier and every reference
fixture in a cheats-enabled test world:

```mcfunction
/tag @s add skyknights.skycraft_experimental
```

Remove the bypass before the fresh-Survival progression session:

```mcfunction
/tag @s remove skyknights.skycraft_experimental
```

The developer bench can supply test materials:

```mcfunction
/skyknights:testbench
```

The experimental tag bypasses technology milestones for testing. It does not
turn on physical cargo. Cargo must remain disabled until the no-duplication
transaction gate is implemented and separately accepted.

## Session A — clean load and starter berth

1. Create a new Survival world with the behavior and resource packs active.
   Use the packaged void-world template when validating the sky-only visual
   presentation. A normal Overworld is acceptable for functional testing but
   will continue generating vanilla terrain below the islands.
2. Do not run a developer command.
3. Confirm automatic arrival on the solid starter island.
4. Confirm Dockmaster Elian appears.
5. Confirm adjacent iron and coal blocks are visible in the walkable surface
   near the crafting table and furnace.
6. Mine either surface block and confirm another block of the same ore is
   directly underneath.
7. Walk east along the wooden dock.
8. Confirm a solid smooth-stone Apprentice berth and connecting walkway exist.
9. Open the Content Log.

Pass:

- no command is needed to create the island, Dockmaster, or Apprentice berth;
- no warning says the starter island is still preparing after generation
  completes;
- the player can reach the berth without jumping a void gap; and
- the Content Log has no Sky Knights block, item, recipe, entity, texture,
  animation, or script error.

## Session B — fresh-Survival first raft

1. Keep the experimental tag removed and do not use the test bench.
2. Follow the tutorial to locate wood, stone, coal, iron, crafting table, and
   furnace.
3. Craft the legacy starter parts and their placed Skycraft wrappers:
   Basic Helm, Ship Core Block, Lift Sail, and Coal Thruster.
4. Build a connected wooden raft inside the Apprentice berth. Use no more than
   24 scanned blocks.
5. Face one engine aft and ensure its certified direction is reported as
   forward thrust.
6. Interact with the Helm and inspect the full engineering report.
7. Select `Certify / Save Blueprint`, then `Launch`.
8. Mount, fly a short circuit, crouch-interact, and dock.

Pass:

- starter resources are sufficient without a debug command;
- exactly one Helm and Core are recognized;
- mass, required lift, lift reserve, thrust, control, seats, hull, and the
  certification cap are understandable;
- launch clears only the connected approved build;
- the player can mount and control the authored proxy;
- docking restores every approved block and state at its exact relative
  coordinate; and
- no item or placed block is gained or lost.

Time the session from first arrival to first successful launch. Target:
30–45 minutes for a new player.

## Session C — non-destructive diagnostics

Try each invalid build separately:

| Case                                    | Expected result                                      |
| --------------------------------------- | ---------------------------------------------------- |
| Missing Helm                            | No scan action exists                                |
| Two connected Helms                     | Launch refused with exact duplicate-Helm diagnostic  |
| Missing Core                            | Launch refused with exact missing-Core diagnostic    |
| Two connected Cores                     | Launch refused with exact duplicate-Core diagnostic  |
| Disconnected decoration                 | Decoration remains and is not consumed               |
| Forbidden chest, TNT, sand, or redstone | Exact unsupported-block diagnostic                   |
| Block outside the berth                 | Outside block remains untouched                      |
| Too many blocks                         | Report shows count and cap                           |
| Excess mass                             | Report shows mass deficit                            |
| Insufficient lift                       | Report shows missing lift                            |
| No aft-facing propulsion                | Report shows no forward thrust                       |
| Obstructed dock destination             | Dock refused without deleting proxy                  |
| Modify a certified block before launch  | Launch refuses stale blueprint or requires recertify |
| Outstanding persisted repair bill       | Launch refuses until repaired                        |

After every refusal, compare the world and inventory with the pre-test state.
There must be no partial clear, material consumption, duplicate, or unrelated
block change.

## Session D — exact blueprint and recovery

Build one Apprentice craft containing a mix of:

- logs and stripped logs;
- planks;
- slab and stair orientations;
- a fence, gate, and trapdoor state;
- white wool; and
- all required components.

Run this matrix:

| Checkpoint                | Action                             | Expected authority after reopen |
| ------------------------- | ---------------------------------- | ------------------------------- |
| Docked                    | Save/quit and reopen               | Exact dock build                |
| Immediately after Launch  | Save/quit as soon as proxy appears | One proxy or one restored build |
| In flight                 | Travel, save/quit, and reopen      | One proxy, no dock copy         |
| Immediately after Dock    | Save/quit during restoration       | One exact dock build            |
| Missing/destroyed proxy   | Destroy proxy, wait for sweep      | Recovered dock build plus bill  |
| Obstructed recovery berth | Place unrelated block before retry | Fail closed; block untouched    |

Pass only if every outcome has one authority. Seeing both a flight proxy and a
complete dock build is a stop-ship failure. Missing both without a recoverable
diagnostic is also a stop-ship failure.

## Session E — reference orders and personal blueprints

1. Enable the experimental tag and place the test bench.
2. Open `Dockmaster > Player-built Skycraft`.
3. View a reference plan and note every required block plus labor fee.
4. Attempt the order while one required material is missing.
5. Confirm nothing is consumed or placed.
6. Supply the exact materials and build the Minnow.
7. Edit its docked wood layout, recertify it, and save it to the personal
   library.
8. Record every inventory stack.
9. Dismantle the registration, clear the berth intentionally, and choose
   `Build Saved`.
10. Confirm the saved design is reconstructed only after every required block
    is consumed.
11. Repeat one order while deliberately obstructing a target block.

Pass:

- plan, reference build, edit, save, and personal materialization use the same
  scanner and engineering rules;
- incomplete and obstructed orders consume nothing;
- a successful order consumes exactly its plan;
- rollback restores both inventory and world on failure; and
- the saved copy receives a fresh airship registration rather than sharing the
  source ID.

## Session F — reference fleet and technology branches

With the experimental tag enabled, test every fixture:

| Certification | Reference craft | Primary observation                   |
| ------------- | --------------- | ------------------------------------- |
| Apprentice    | Minnow          | Small readable raft                   |
| Ember         | Dart            | Compact, faster cutter                |
| Ember         | Cargo Punt      | Reserved cargo tradeoff               |
| Specialist    | Cloudwhale      | Airbag/propeller dirigible silhouette |
| Specialist    | Aether Disc     | Compact downward-lift/UFO silhouette  |
| Specialist    | Frostwing       | Frostfire combat profile              |
| Expedition    | Surveyor        | Crew/repair/utility profile           |
| Masterwork    | Grand Cruiser   | Highest provisional cap               |

For each fixture:

1. Prepare its certification berth.
2. View the plan.
3. Build and certify it.
4. Confirm block, mass, engine, seat, and hardpoint caps.
5. Launch, mount every certified seat, fly, dock, and compare the restored
   build.
6. Record serialized blueprint bytes, launch/dock time, server tick behavior,
   and client frame behavior where available.

The authored proxy need not reproduce every placed voxel. It must make the
craft class, scale, lift family, and major installed systems recognizable.
Record that judgment separately from exact dock reconstruction.

Do not promote 56-, 96-, 160-, or 240-block caps from provisional status until
the lowest supported device and four-player session pass.

## Session G — damage, repair, and combat

1. Build a tagged Frostwing or another certified craft with a Cannon
   Hardpoint.
2. Assign a second player the Gunner role.
3. Carry a Cannon Control and Aether Charges.
4. Confirm an owner or assigned gunner aboard the craft can fire.
5. Confirm a guest and an unassigned passenger cannot fire.
6. Take damage and note the persisted hull bill and disabled-system count.
7. Dock.
8. Attempt to relaunch without repairs.
9. Give the owner or mechanic the exact displayed Repair Kit count and repair.
10. Relaunch and confirm the bill is cleared.
11. Destroy the proxy and wait for registered-berth recovery.

Pass:

- every consequential action is server-authorized;
- damage persists through docking/reload;
- damaged craft cannot relaunch;
- repair consumes exactly the displayed number of kits or rolls back;
- destruction restores the blueprint with a repair bill; and
- combat does not activate a cargo inventory or duplicate ammunition.

Controlled descent and subsystem-specific flight penalties are not accepted
yet merely because the pure rule model exists. Record them as pending until
their real runtime behavior is implemented and observed.

## Session H — multiplayer permissions

Use two players first, then four:

| Role      | Must be able to                              | Must not be able to                 |
| --------- | -------------------------------------------- | ----------------------------------- |
| Owner     | Edit, certify, launch, dock, recover, assign | —                                   |
| Builder   | Use Helm while docked editing is unlocked    | Launch, recover, manage crew        |
| Pilot     | Occupy pilot seat and dock                   | Edit, manage crew, gun by default   |
| Navigator | Occupy assigned seat                         | Pilot, gun, edit                    |
| Gunner    | Occupy assigned seat and fire hardpoint      | Pilot, edit, manage crew            |
| Mechanic  | Repair at dock                               | Pilot, gun, manage crew             |
| Passenger | Occupy a certified passenger seat            | Consequential controls              |
| Guest     | Observe                                      | Retain unauthorized seat or control |

Also test:

- excess riders beyond the certified seat count;
- owner disconnect while riders remain;
- two nearby active craft;
- four nearby active craft;
- simultaneous Dockmaster/Helm use; and
- reconnect after host save/quit.

One active pilot must remain authoritative. Unauthorized riders must be
ejected without harming the craft or another player.

## Session I — progression and legacy compatibility

1. Use a fresh Survival world with no experimental tag.
2. Complete the Skiff, Ember, Skycutter, Frostspire, refit, Raider, Glacier,
   Ashfall, and Sanctum path without `/give`, teleport, or island commands.
3. Confirm each guaranteed cache exists and is stocked once.
4. Return to the Dockmaster after each discovery/material milestone.
5. Confirm normal progression does not expose unmeasured advanced Skycraft
   tiers.
6. Load a backed-up `0.3.1` world containing a legacy Skiff and Skycutter.
7. Confirm both legacy craft still mount, fly, dock, recover, and retain their
   saved configuration.
8. Confirm no legacy craft is silently converted into a player-built record.

Any lost one-time progression item that permanently blocks the route is a
progression failure. Do not test migrations on the only copy of a world.

## Session J — input, accessibility, and device matrix

Repeat Apprentice build/inspect/launch/fly/dock with:

| Platform/device | Keyboard/mouse | Controller | Touch | Result |
| --------------- | -------------- | ---------- | ----- | ------ |
| Windows client  |                |            | n/a   |        |
| Console target  | n/a            |            | n/a   |        |
| Mobile target   | optional       | optional   |       |        |
| Lowest target   |                |            |       |        |

Check:

- Helm and Dockmaster form text is readable without scrolling past the primary
  action;
- error colors are not the only carrier of meaning;
- mount, ascent, descent, turning, braking, crouch-interact, and dismount are
  discoverable;
- camera does not clip badly through each proxy;
- rider positions are usable; and
- no control requires a hover-only or keyboard-only gesture.

## Physical cargo negative gate

Player-built cargo racks currently reserve lift and expose cargo capacity in
engineering, but flight inventory authority is disabled.

Pass:

- no player-built proxy exposes a physical cargo inventory;
- Dockmaster/Helm text does not claim item transfer exists; and
- no launch or dock path attempts to move container contents.

Do not reinterpret this expected refusal as a completed `0.5.0` cargo feature.
Physical cargo requires a separate launch/dock/restart/destruction
no-duplication test matrix.

## Release decision

The integrated prototype may be called host-green when automated verification
passes. It may be called developer-testable when the pack loads cleanly and
the experimental sessions work. It is not feature complete until every
roadmap definition-of-complete row has recorded host, BDS, hands-on,
multiplayer, input, migration, and lowest-device evidence.

Stop the release for:

- block, component, item, or cargo duplication;
- unrelated block deletion;
- both docked and flight authorities after recovery;
- an unrecoverable missing blueprint;
- an unauthorized consequential action;
- a normal-play certification cap promoted without performance evidence;
- a legacy save regression; or
- a content or script error during clean pack load.
