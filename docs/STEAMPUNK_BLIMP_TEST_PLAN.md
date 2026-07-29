# Steampunk Blimp Hands-On Test Plan

Status: pending Minecraft validation

> Build under test: `0.3.9`

This plan validates the summon-only `skyknights:steampunk_blimp` visual and
handling prototype. It does not validate crafting, technology progression,
ownership, custom-airframe conversion, combat, or natural spawning.

## Test record

Record these values before testing:

| Field               | Value          |
| ------------------- | -------------- |
| Git commit          |                |
| Add-on version      |                |
| `.mcaddon` SHA-256  |                |
| Minecraft version   |                |
| Platform and input  |                |
| World provenance    | new / existing |
| Multiplayer clients |                |

Use a disposable test world with cheats enabled and both Sky Knights packs
active. Confirm `/skyknights:debug` reports the expected add-on version before
evaluating the model.

## Session A — Registration and spawning

1. Run `/skyknights:blimp` while facing clear open sky.
2. Confirm exactly one Steampunk Blimp appears ahead of and slightly above the
   player.
3. Run `/skyknights:debug`.
4. Confirm `blimpsHere=1`.
5. Repeat the command once and confirm `blimpsHere=2`.

Pass conditions:

- the command is registered and returns success;
- the entity name is `Steampunk Blimp Prototype`;
- the craft does not intersect the player or nearby terrain; and
- no missing-entity, missing-geometry, missing-texture, or content-log error
  appears.

## Session B — Silhouette, texture, and culling

Inspect the stationary craft from the front, rear, both sides, above, and below.

Confirm:

- the narrow bow points toward local forward travel;
- the canvas balloon has a tapered nose and stern;
- dark ribs follow the envelope without obvious floating pieces;
- the tail fins form a readable dirigible silhouette;
- suspension members visibly connect the envelope and gondola;
- the gondola reads as a wooden vessel with a cabin, deck, windows, and engines;
- copper, brass, wood, canvas, glass, and cyan Aether accents remain distinct;
- there are no magenta missing textures, transparent holes, inverted faces,
  severe texture stretching, or distracting z-fighting; and
- the complete craft remains visible throughout normal third-person camera
  distances and does not disappear when only the bow, tail, balloon, or gondola
  is in view.

Capture at least six screenshots: front, rear, port, starboard, above, and
three-quarter gondola view.

## Session C — Propeller animation

Observe both propellers while the craft is stationary and while it is piloted.

Confirm:

- both hubs rotate around their own pivots;
- the blades do not orbit around the engine or gondola;
- left and right rotations look mechanically coherent;
- no blade clips through the engine housing;
- animation continues after leaving and returning to render distance; and
- save/reload does not permanently stop an animation.

## Session D — Seats and cameras

Test all four seats with enough clear air beneath the craft.

1. Start in first person and mount from the gondola deck side.
2. Confirm the camera changes once to third person within five ticks and the
   complete Blimp fits in the 16-block rideable camera radius.
3. Confirm the first rider receives the helm/controlling seat.
4. Attempt to cycle perspective and confirm the mount-scoped third-person
   preset remains active without changing the player's configured FOV.
5. Add three players or repeat mounting after filling seats with available test
   clients.
6. Dismount from each seat and confirm the normal player camera returns.
7. Remount once and confirm the mount-scoped third-person assist activates
   again.

Pass conditions:

- riders appear in or above the gondola rather than inside the balloon, hull,
  engines, or propellers;
- only the helm seat controls movement;
- every rider receives a usable third-person view rather than a view blocked by
  the balloon;
- third person remains active while mounted, FOV is unchanged, and dismount
  restores the player's selected normal perspective and perspective input;
- no rider falls through the floor while mounted; and
- dismount places the rider on or beside the gondola without a void fall.

## Session E — Flight and collision

From the helm seat:

1. Move forward and confirm the narrow nose leads.
2. Fly backward, strafe both directions, climb, and descend.
3. Perform a full turn at low and moderate speed.
4. Stop input and observe drift or unwanted motion.
5. Gently approach an island wall and the starter dock.
6. Walk into the unoccupied craft.

Pass conditions:

- controls match the existing Sky Knights air-controlled craft convention;
- the blimp feels slower and heavier than the Skiff and Outrigger;
- turns remain controllable without sudden yaw reversal;
- the craft does not fall under normal operation;
- collision is useful without creating a much larger invisible wall than the
  gondola;
- terrain contact does not eject or suffocate riders; and
- walking into an unoccupied craft does not push it away.

## Session F — Persistence and cleanup

1. Give the craft a custom name.
2. Move it away from its spawn location.
3. Save and exit the world.
4. Reload the world.
5. Travel away beyond render distance and return.
6. Remove the prototype with `/kill @e[type=skyknights:steampunk_blimp]`.

Pass conditions:

- the blimp retains its name and position after reload;
- geometry, texture, propellers, seats, and controls still work;
- returning from render distance does not duplicate the craft; and
- removal leaves no invisible collision, riders, or replacement entity.

## Session G — Regression and multiplayer

Confirm the new prototype does not change:

- `/skyknights:skiff`;
- `/skyknights:skycutter`;
- `/skyknights:outrigger`;
- owned Skycraft limits or persistence;
- Dockmaster progression; or
- island generation and recovery.

With two or more clients, verify seat occupancy, pilot authority, passenger
camera behavior, disconnection/reconnection, and save/reload. Repeat the
mounting and camera checks on keyboard/mouse, controller, and touch when those
devices are available.

## Acceptance decision

The prototype is visually accepted only when Sessions A–F pass with no
content-log errors and the required screenshots have been reviewed. Multiplayer
and device gaps may remain explicitly recorded, but the entity must stay
summon-only until its intended progression role, scale, performance cost, and
combat relationship are separately approved.
