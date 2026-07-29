# Aether Outrigger Hands-On Test Plan

> Build under test: `0.3.9`
>
> Scope: summon-only visual and handling prototype. It is intentionally not an
> owned ship, progression reward, recovery target, or Skycraft blueprint yet.

## Preparation

Build and deploy the current stable packs:

```powershell
npm run verify
npm run local-deploy -- --once
```

If another in-progress slice temporarily prevents a fresh build, use only a
production `.mcaddon` produced by a recorded green Outrigger verification.
Enable cheats, Content Log File, and Content Log GUI.

Enter a disposable test world and run:

```text
/skyknights:outrigger
```

The command should spawn one named prototype in front of the player. Clean up
after testing with:

```text
/kill @e[type=skyknights:aether_outrigger]
```

## Session A — rendering and silhouette

1. Inspect the craft from every side in first and third person.
2. Confirm the hull has no invisible or inside-out faces.
3. Confirm both aft lift drums render with their paired struts and end bands.
4. Confirm the model is approximately twice the dimensions of the original
   `0.3.7` prototype: roughly 5 blocks wide, 5.6 high, and 6.9 long.
5. Confirm the mast is upright and aft of the forward seats, with the sail
   forming one broad rectangular assembly above the seated eye line.
6. Confirm the stern engine and four nozzles are visible.
7. Move 32, 64, and 96 blocks away, then return.

Pass when:

- no missing-texture pattern, transparent hull face, z-fighting, or Content Log
  asset error appears;
- the sail reads as a single blue/white cloth surface rather than three
  disconnected slabs;
- both lift drums remain attached and symmetrically positioned; and
- the model does not disappear while still reasonably visible.

Record screenshots of the bow, port, starboard, stern, and overhead views.

## Session B — seats and cameras

1. Start in first person, then mount the pilot seat by interacting with the
   craft.
2. Within five ticks, confirm the camera changes to a third-person view
   that fits the complete craft at its 12-block rideable radius.
3. Attempt to cycle perspective and confirm third person remains active for the
   ride without changing the player's configured FOV.
4. Dismount and confirm the camera returns to the player's selected normal
   perspective and the perspective-change input works again.
5. Remount and confirm the third-person assist activates again.
6. Mount the passenger seat with a second local/LAN player when available.
7. After the camera checks, optionally cycle to first person while unmounted,
   remount, then dismount and verify first person is restored.

Pass when:

- both riders sit on the forward deck rather than inside the mast, sail, deck,
  engine, or each other;
- the automatic third-person camera shows the entire doubled craft without the
  sail or lift drums blocking control;
- the camera remains third person for the mounted interval without changing
  the player's configured FOV;
- dismount restores the normal camera and places the player safely on or beside
  the hull; and
- after dismount, the player's previously selected perspective and perspective
  input are usable again.

Record desired seat offsets in blocks: X is left/right, Y is height, and Z is
fore/aft.

## Session C — flight and collision

1. Test forward, reverse, strafe, turning, ascent, and descent.
2. Make a slow approach to the starter dock and an ambient island.
3. Walk into the unmounted craft.
4. Land, dismount, remount, and launch again.

Pass when:

- the pilot controls the craft from seat 0;
- forward travel follows the bow, not the stern;
- the craft does not slide away when bumped;
- collision is close enough to the visible hull for this prototype; and
- landing and relaunch do not trap the player.

Handling values remain provisional. Record turn rate, 12-block camera radius,
5.6-by-3 collision contract, and seat-offset changes before altering
progression.

## Session D — persistence and cleanup

1. Leave the craft unmounted and run `/reload`.
2. Save, close, and reopen the world.
3. Confirm the named prototype remains usable.
4. Run the cleanup command.
5. Save and reopen again.

Pass when the prototype persists until deliberately killed and does not
reappear after cleanup.

## Acceptance boundary

This prototype is ready for a product role only after Sessions A-D pass and a
two-player seat check is recorded. Then choose one explicit integration:

1. add it as an Ember-tier reference visual under the existing
   `skyknights:airship_flight` Skycraft proxy; or
2. design a separate owned-ship schema/migration/recovery slice.

The first option is recommended. Do not add a third legacy `ShipFrame` merely
to test art or handling.
