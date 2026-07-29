# Consolidated Hands-On Acceptance Plan

> Target: the exact current Sky Knights build recorded in the test header.
>
> Initial target when this plan was written: `0.3.8`; current package target:
> `0.3.10`.
>
> Historical labels such as `0.1.0`, `0.2.0`, `0.3.1`, and `0.3.3` identify
> the feature or migration being validated. Except for an old-world migration
> fixture, test the behavior with the current build rather than reinstalling
> each historical add-on version.

This is the execution checklist for the open gates in
[`PROJECT_STATUS.md`](PROJECT_STATUS.md). The focused plans remain the
authoritative source for detailed steps and expected behavior. This plan
orders them, removes duplicate setup, and separates stable release evidence
from milestone, device, experimental, and prototype evidence.

## How to use this plan

Run one wave at a time and report after each wave. Do not wait until every
device and optional profile is available before reporting useful results.

Use these result codes:

| Code      | Meaning                                                                                 |
| --------- | --------------------------------------------------------------------------------------- |
| `PASS`    | Every required observation matched the plan and evidence was recorded.                  |
| `FAIL`    | The build ran, but one or more required observations did not match.                     |
| `BLOCKED` | A prerequisite such as an old-world fixture, second player, or device was unavailable.  |
| `NT`      | Intentionally not tested in this run; include the reason.                               |
| `NA`      | The scenario does not apply to this build or release track.                             |
| `CARRIED` | Prior evidence is being retained; record its build/date and why a rerun is unnecessary. |

Do not record `BLOCKED`, `NT`, `NA`, or `CARRIED` as `PASS`.

### Stop and report immediately when

- the Content Log shows a pack-load, registry, structure, texture, animation,
  Molang, Script API, watchdog, or unhandled script error;
- `/skyknights:debug` reports the wrong version or `below=terrain` in a
  void-template session;
- player inventory, cargo, placed blocks, modules, or one-time progression
  items are duplicated or deleted;
- both a docked craft and its flight proxy exist, or neither exists without a
  recoverable diagnostic;
- a player-authored block is overwritten by generation or recovery;
- an unauthorized player can refit, launch, recover, steer, fire, or manage
  another player's craft;
- a valued world was opened instead of a disposable world or backup copy.

For a failure, preserve the world and capture evidence before retrying or using
a recovery command. A recovered run is useful diagnostic evidence, but it does
not convert the original failure into a pass.

## Gate disposition

This table prevents historical rows from being treated as equally urgent.

| Track                                | Priority    | What it closes                                                                         | Disposition                                                               |
| ------------------------------------ | ----------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Current package and void template    | P0          | Clean `.mcaddon`/template import, pack binding, Content Log, current build identity    | Run first                                                                 |
| Current stable game                  | P0          | Fresh bootstrap, starter route, legacy skiff/Skycutter, recovery, progression          | Run on the current build                                                  |
| `0.3.8` archipelago                  | P0          | Tier, altitude, rare burn, continent, reload, obstruction, compatibility               | Run Sessions C–F; collect bounded Session G metrics                       |
| Phase 3 safety                       | P0          | Schema migration, layout stability, player-modified protection, interrupted generation | Run after the fresh baseline                                              |
| Dockyard/refit/combat                | P1          | Refit transactions/effects, cannon, Raider, reward, reload/recovery                    | Milestone acceptance; run after P0                                        |
| Basic player-built Skycraft          | P1          | Apprentice build, exact reconstruction, diagnostics, saved/reference plans             | Run Sessions A–E before advanced tiers                                    |
| Multiplayer/input/device             | P1          | Ownership, seats, controller, touch, weakest-device behavior                           | Run when hardware/players are available; otherwise `BLOCKED` or `NT`      |
| Advanced Skycraft                    | P2/gated    | Provisional references, caps, damage, roles, progression/device matrix                 | Run only after basic Skycraft passes                                      |
| BDS `SimulatedPlayer` expansion      | P2/tooling  | Server-side mounting/permission automation                                             | Separate engineering task; not a substitute for client testing            |
| Custom dimension                     | P2/optional | Experimental Strategy B only                                                           | Non-blocking for the stable void-Overworld strategy                       |
| Aether Outrigger and Steampunk Blimp | Prototype   | Summon-only art, scale, camera, seats, handling, persistence                           | Run both focused `0.3.9` plans; report separately from stable progression |
| Player-built physical cargo          | Inactive    | Future transactional cargo authority                                                   | `NA` until implemented; verify only that it stays unavailable             |

The earlier `0.3.6` Sessions A, A2, and B may be recorded as `CARRIED`, but the
current package/template identity and Content Log must still be checked. The
new `0.3.8` variety behavior cannot inherit the older evidence.

## Test record

Copy this header into every wave report.

| Field                                      | Value |
| ------------------------------------------ | ----- |
| Test wave and session IDs                  |       |
| Date/time and tester                       |       |
| Git commit (`git rev-parse --short HEAD`)  |       |
| Working tree clean/dirty                   |       |
| Add-on/package version                     |       |
| Package/template filename and timestamp    |       |
| Minecraft version                          |       |
| Device, OS, and client/host/BDS            |       |
| Input method                               |       |
| Players connected                          |       |
| World ID and provenance                    |       |
| World seed                                 |       |
| Content Log enabled/clean                  |       |
| `/skyknights:debug` version/schema/profile |       |
| `/skyknights:debug` `below=` value         |       |
| Screenshot/video folder                    |       |

If the worktree is dirty, list the relevant modified files. A dirty build can
provide development evidence, but it must not be described as a clean-commit
release result.

### Evidence naming

Use `W<no>-S<no>-<short-description>` for screenshots, video, and Content Log
excerpts. Examples:

- `W1-S01-debug-start.png`
- `W2-S04-continent-reload.mp4`
- `W4-S02-cargo-downgrade-content-log.txt`

For timing and performance checks, record an approximate value rather than
writing only "felt fine."

## World set

Keep destructive and progression evidence separate.

| World ID | Purpose                                        | Rules                                                                       |
| -------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| `V1`     | Fresh void-template acceptance                 | No test bench, `/give`, teleport, island command, or progression shortcut   |
| `G1`     | Generation interruption and obstruction safety | Disposable; cheats allowed; always resume the archipelago after pausing     |
| `N1`     | Normal Infinite-world compatibility            | Disposable; vanilla terrain is expected                                     |
| `M1`     | Schema-4/legacy migration                      | Backup copy only; never the sole copy                                       |
| `R1`     | Fresh progression, refit, Raider, and recovery | No progression shortcut; cheats only for diagnostics or a documented repeat |
| `S1`     | Player-built Skycraft                          | Fresh basic session first; experimental tag only where explicitly required  |
| `D1`     | Multiplayer/input/device matrix                | Record host, joining clients, devices, inputs, and player roles             |
| `E1`     | Summon-only entity prototypes                  | Disposable; prototype commands allowed                                      |
| `X1`     | GameTest or custom-dimension profile           | Separate profile-specific world; never combine profiles casually            |

World copies should receive a new ID such as `M1-copy1` or `G1-reload2`.

## Wave 0 — build, package, and evidence preflight

Run from the repository root:

```powershell
git status --short
git rev-parse --short HEAD
npm run verify
npm audit --audit-level=high
npm run mcaddon:production
```

Run `npm ci` first only for a fresh clone or when the installed dependencies do
not match `package-lock.json`.

For a newly generated void template, use the configured external BDS workflow:

```powershell
npm run world-template:void
npm run world-template:install
```

`world-template:install` is a local development convenience that extracts the
template into this machine's Minecraft storage. It does not prove that a clean
client can import the `.mctemplate`; that is a separate Wave 1 gate.

If the external BDS prerequisite is unavailable, record `BLOCKED` for template
regeneration. A previously built template may still be tested only when its
exact commit/version provenance is known.

- [ ] `W0-S01` Record the complete test header.
- [ ] `W0-S02` `npm run verify` passes.
- [ ] `W0-S03` `npm audit --audit-level=high` reports zero applicable findings.
- [ ] `W0-S04` The production `.mcaddon` exists and its timestamp matches this run.
- [ ] `W0-S05` The void template exists and its provenance is recorded.
- [ ] `W0-S06` Restart Minecraft after installing packs/templates.
- [ ] `W0-S07` Enable Content Log File and Content Log GUI.
- [ ] `W0-S08` Confirm no duplicate stable pack is activated beside the template's embedded packs.

Report the command exit status and first relevant error for any failed preflight
step. Do not paste an entire repetitive log unless requested.

## Wave 1 — current stable package, template, and core route

Detailed sources:

- [`HANDS_ON_TEST_PLAN.md`](HANDS_ON_TEST_PLAN.md), stable pack and template
  import sections;
- [`ARCHIPELAGO_HANDS_ON_TEST_PLAN.md`](ARCHIPELAGO_HANDS_ON_TEST_PLAN.md),
  Sessions A, A2, and B;
- [`PHASE_2_PLAYTEST.md`](PHASE_2_PLAYTEST.md); and
- [`CRYSTAL_TO_CUTTER_TEST_PLAN.md`](CRYSTAL_TO_CUTTER_TEST_PLAN.md).

### W1-S01 — clean package/import boundary

On a clean client or clean Minecraft storage profile:

- [ ] Import the production `.mcaddon` without manual archive repair.
- [ ] Confirm the Behavior Pack and Resource Pack appear once with the expected version.
- [ ] Create a disposable normal pack world and confirm both packs activate.
- [ ] Wait at least 15 seconds and inspect the Content Log.
- [ ] Run `/skyknights:debug`; record the version, schema, profile, and commands.
- [ ] Save, reopen, and confirm pack binding and commands persist.

This proves standalone-package import. It does not prove the void template.

### W1-S02 — clean-client `.mctemplate` import

On a client or clean storage profile that does not already contain the Sky
Knights template or standalone packs:

- [ ] Import
      `dist/world-template/sky_knights_void_world.mctemplate` through a supported
      Minecraft/OS file-import path.
- [ ] Do not unzip, manually repair, or use `world-template:install` for this
      gate.
- [ ] Do not install or activate a duplicate standalone `.mcaddon`; the
      template carries its own packs.
- [ ] Minecraft reports a successful import.
- [ ] **Sky Knights: Void Realm** appears once in the world-template list.
- [ ] A world can be created from the imported template.
- [ ] The created world has both embedded packs bound and active.
- [ ] Save/reopen preserves the binding.

If the machine has no registered or otherwise supported `.mctemplate` import
path, report `BLOCKED — client import handler unavailable`. Local installation
may still support development testing, but it cannot be recorded as a
clean-client import pass.

### W1-S03 — fresh void-template bootstrap

Create `V1` from **Sky Knights: Void Realm**, not as a normal Infinite world.

- [ ] Enter without running a Sky Knights command.
- [ ] Automatic arrival places the player safely at the starter dock.
- [ ] `/skyknights:debug` reports the recorded current version.
- [ ] Debug reports `schema=5`, `profile=standard`, and `below=void`.
- [ ] Starter Island, Ember Outpost, and Frostspire finish automatically.
- [ ] `activeJob=none` after bootstrap settles.
- [ ] Dockmaster Elian is present and usable.
- [ ] No vanilla terrain is visible below the sky realm.
- [ ] Content Log has no Sky Knights error.
- [ ] Save, close, reopen, and confirm the same world state.
- [ ] Copy the world and confirm the copy retains embedded pack bindings and state.

If `below=terrain`, stop. All sky-only observations from that world are
invalid.

### W1-S04 — starter resources and first craft

Do not use commands, the test bench, creative inventory, flight, or another
player's items.

- [ ] At least four iron and two coal outcrops are visible from the walkable surface.
- [ ] Four oak trees and the exposed stone boulder are present and reachable.
- [ ] Digging under each sampled outcrop continues into the same resource.
- [ ] Craft a wooden pickaxe, stone pickaxe, one Ship Core, and one Thruster Module.
- [ ] Record iron, coal, logs, and stone remaining.
- [ ] No required starter resource is on the underside or outside a safe walking route.

### W1-S05 — released progression route

- [ ] Assemble, mount, fly, land, and recover the starter skiff.
- [ ] Obtain the Ember Aether Crystal without a developer shortcut.
- [ ] Return the Crystal and assemble the Skycutter.
- [ ] Verify Skycutter seats, standard cargo, and standard modules.
- [ ] Obtain Frostspire Froststeel and return to the Dockmaster.
- [ ] Objectives advance at each expected milestone.
- [ ] Guaranteed progression content appears once.
- [ ] Save/reopen preserves inventory, objectives, owned craft, cargo, and modules.
- [ ] Falling below the current rescue boundary recovers the player safely.
- [ ] Repeat recovery while piloting; no duplicate or missing craft results.

Record any command used. A run requiring a repair/progression command is not a
fresh-progression pass.

### W1-S06 — focused fresh-Survival closure

These observations explicitly close the historical `0.2.0` fresh-Survival
gate against the current build:

- [ ] Walk the complete starter island, including outer grass and dock
      surfaces; no ordinary route exposes an unintended hole.
- [ ] Ember's guaranteed chest contains one Aether Crystal, 24 iron, and 8
      redstone.
- [ ] Frostspire's guaranteed chest contains 16 Froststeel Ingots.
- [ ] Returning Froststeel advances the objective to `craft_combat_refit`.
- [ ] Guaranteed Froststeel and redstone are sufficient to craft every
      advanced module and the cannon.
- [ ] The route required no `/give`, test bench, teleport, island, objective,
      or progression shortcut.

### W1-S07 — Dockmaster deck-destruction response

Use disposable copies because the post-ship transformation is intentionally
persistent.

Before the first ship is built:

- [ ] Break the deck plank directly beneath the Dockmaster.
- [ ] The plank is rebuilt automatically because the Dockmaster is still
      required for first-ship progression.
- [ ] Elian remains a usable steward.
- [ ] Elian does not fall and teleport back in a repeating loop.

After the first ship is built, in a separate disposable copy:

- [ ] Break the deck plank beneath the Dockmaster.
- [ ] The existing entity rises and becomes hostile rather than duplicating.
- [ ] Hostile Elian flies, targets, and damages players within the documented
      48-block range.
- [ ] No repeated fall/teleport/respawn loop occurs.
- [ ] Save/reopen preserves the wrathful state without creating another
      Dockmaster.
- [ ] Player and ship recovery remain usable.
- [ ] Content Log remains clean in both branches.

## Wave 2 — `0.3.10` archipelago acceptance

Use the exact procedures in
[`ARCHIPELAGO_HANDS_ON_TEST_PLAN.md`](ARCHIPELAGO_HANDS_ON_TEST_PLAN.md).
Sessions C–F are the stable variety gate. Session G is a bounded measurement
run and does not require reaching the lifetime cap.

### W2-S01 — lazy generation baseline

- [ ] Ambient count increases through ordinary exploration.
- [ ] Only one `a3_...` solo or preserved `a2_...` continent job is active at
      a time.
- [ ] Placement stays outside the authored central realm.
- [ ] Islands do not stamp around a player or occupied craft.
- [ ] Islands do not visibly intersect.
- [ ] Record longest visible hitch and approximate FPS.

### W2-S02 — family, tier, altitude, scale, and pattern sample

Sample at least 40 solo islands across several seed-rotated family arcs between
600 and 3,200 blocks from origin.

- [ ] Observe at least one islet.
- [ ] Observe at least one Standard island.
- [ ] Observe at least one crag.
- [ ] Observe at least one landmark.
- [ ] Origins visibly occupy multiple deep/low/mid/high/crown bands.
- [ ] Families form readable arcs rather than alternating at every site.
- [ ] The field reads as irregular Fibonacci/golden-angle rings, not a square
      grid or rigid spokes.
- [ ] Sampled tiers provide safe landing areas; one Standard, Crag, and
      Landmark each has useful small-base space.
- [ ] Four-part Crags and sixteen-part Landmarks have no open seams.
- [ ] No ambient island contains progression loot, Dockmaster, or custom progression entities.

### W2-S03 — run-3 scope boundary

- [ ] New solo jobs use `a3_` IDs.
- [ ] Existing `a1`/`a2` terrain remains unchanged in an upgraded world.
- [ ] Existing or interrupted run-2 burn structures remain valid.
- [ ] No failure is recorded merely because run-3 does not select a new burn
      variant; large burn-content parity is a later content slice.

### W2-S04 — continent composition

At one reported outer-ring continent site:

- [ ] Allow the complete 21-part job to finish.
- [ ] The result reads as one landmass, roughly 3–5× a landmark island.
- [ ] No open component seams or rectangular air-carve scars are visible.
- [ ] A central massif, at least two lakes, a chasm, and a bridge are present.
- [ ] Placement is spread across ticks rather than one long frozen frame.
- [ ] A safe dock/arrival point does not place the player inside blocks or over void.
- [ ] Record total placement time, longest hitch, FPS, and Content Log state.

### W2-S05 — solo and multipart reload safety

Use `G1`.

- [ ] Close/reopen while a solo `a3_...` job is active.
- [ ] The solo completes or retries without duplicate, shift, or overlay.
- [ ] Close/reopen during continent placement.
- [ ] The continent resumes from its saved part cursor.
- [ ] Already checkpointed parts remain intact.
- [ ] Visibly completed components remain intact while later parts finish.
- [ ] No `skyknights_generation_*` ticking area remains stuck.
- [ ] Counts never decrease or double-increment for one ID.
- [ ] Dynamic-property bytes remain under the configured limit.

Editing a checkpointed component before later parts finish is automated-only
evidence. The stable command surface does not expose or pause the multipart
cursor at a deterministic point, so do not attempt to pass that contract by
timing a manual edit. Its regression coverage is in
`tests/generation-service-multipart.test.ts`; this session supplies the
in-engine resume, seam, and duplicate observations.

### W2-S06 — occupied-volume protection

Follow the pause/setblock/resume procedure in the focused plan.

- [ ] Pause and confirm `paused=true activeJob=none`.
- [ ] Place a conspicuous block inside the next target volume.
- [ ] Leave the player-clearance volume.
- [ ] Resume generation.
- [ ] The player block remains.
- [ ] The candidate is skipped without partial placement.
- [ ] Later candidates continue generating.
- [ ] Archipelago generation is resumed before leaving the world.

### W2-S07 — normal-world compatibility

Use `N1`.

- [ ] Normal vanilla terrain remains untouched.
- [ ] Ambient islands place only where the complete target volume is air.
- [ ] Terrain, mountains, and player builds cause safe skips.
- [ ] Debug reports the non-void presentation accurately.

### W2-S08 — bounded performance run

- [ ] Explore new cells for 30 minutes on the strongest available device.
- [ ] Explore for 10 minutes on the weakest target device, if available.
- [ ] Record start/end solo and continent counts.
- [ ] Record average and worst visible hitch.
- [ ] Record approximate FPS before and during placement.
- [ ] Record save size before and after.
- [ ] Record dynamic-property bytes and Content Log warnings.
- [ ] Record memory, disconnect, or multiplayer symptoms.
- [ ] Confirm counts stay within 224 solos and two continents.

Reaching the caps is not required.

## Wave 3 — Phase 3 layout, preservation, and migration safety

Detailed source:
[`PHASE_3_STABILIZATION_TEST_PLAN.md`](PHASE_3_STABILIZATION_TEST_PLAN.md).

Run current schema-5 behavior. Do not reinstall `0.3.1` merely because the
original plan was written then.

### W3-S01 — three-world fresh bootstrap

Create three disposable current-build worlds without generation or recovery
shortcuts.

| World  | Auto arrival | Starter/Ember/Frostspire complete | `activeJob=none` | Content Log clean |
| ------ | ------------ | --------------------------------- | ---------------- | ----------------- |
| `G2-a` | [ ]          | [ ]                               | [ ]              | [ ]               |
| `G2-b` | [ ]          | [ ]                               | [ ]              | [ ]               |
| `G2-c` | [ ]          | [ ]                               | [ ]              | [ ]               |

- [ ] A visibly placed starter never remains indefinitely queued.
- [ ] Every world preserves stable layout origins across one reopen.

### W3-S02 — player-modified terrain protection

- [ ] Place a distinctive block inside a generated island's structure volume.
- [ ] Break a different original block.
- [ ] Debug marks the island player-modified.
- [ ] Reopen twice.
- [ ] Both edits remain.
- [ ] Startup and safe bootstrap commands do not restamp the island.

### W3-S03 — activation isolation

- [ ] Planned/partial structures remain inactive unless their dependencies are built and enabled.
- [ ] No missing planned entity, item, loot, or progression identifier appears.
- [ ] Existing released progression remains usable.
- [ ] Ambient islands remain free of progression activation.

Use the current content matrix as authority; do not assume the historical list
in the older plan is still complete.

### W3-S04 — interrupted registry placement

- [ ] Exit while an automatic job is queued or mid-checkpoint.
- [ ] Reopen without a generation command.
- [ ] The job resumes or safely recognizes completed work.
- [ ] Guaranteed chests and tagged entities do not duplicate.
- [ ] Later queued released islands continue.
- [ ] `activeJob` returns to `none`.

### W3-S05 — schema-4/current migration

Use only a backup copy `M1`.

- [ ] Record original island coordinates and player-authored blocks.
- [ ] Record inventory, cargo, modules, objectives, Raider state, and owned craft.
- [ ] Open the copy with the current build.
- [ ] World schema migrates to 5 exactly once.
- [ ] Existing released islands do not relocate.
- [ ] Player-authored terrain is not restamped.
- [ ] Inventory, cargo, modules, objectives, encounter state, and craft persist.
- [ ] Layout origins and seed remain identical across two reopens.
- [ ] No island, chest, entity, or craft duplicates.

If no suitable schema-4 fixture exists, report `BLOCKED — fixture unavailable`.

### W3-S06 — `0.1.0`/`0.2.0` legacy fixture

This is one migration scenario, not a request to replay every old binary.

- [ ] Use a backup copy with known old starter/Dockmaster/craft state.
- [ ] Record the fixture's actual originating version and schema.
- [ ] Open with the current build.
- [ ] Legacy skiff/Skycutter remain usable or recoverable.
- [ ] Standard Skycutter module loadout and cargo persist.
- [ ] Current objectives are assigned without duplicating rewards.
- [ ] A second reopen makes no further destructive migration.

If no trustworthy fixture exists, report `BLOCKED` and keep this gate open.

## Wave 4 — Dockyard refit, combat, and recovery

Use `R1` and follow
[`DOCKYARD_REFIT_COMBAT_TEST_PLAN.md`](DOCKYARD_REFIT_COMBAT_TEST_PLAN.md).
The historical `0.2.0` label identifies the feature slice; test the current
build.

### W4-S01 — recipes and refit transaction

- [ ] Craft Armored Hull, Frostfire Engine, Expanded Cargo Hold, Aether Cannon, and charges.
- [ ] An undocked craft cannot be refitted.
- [ ] A non-owner cannot refit it.
- [ ] Every advanced module can replace and return its standard module.
- [ ] Cancel, already-installed, and unowned-item cases change nothing.
- [ ] A full inventory cannot delete or duplicate a module.
- [ ] Debug and visible geometry match the installed module.

### W4-S02 — module behavior

- [ ] Armored Hull changes maximum hull from 120 to 180.
- [ ] Armor reduces damage and its plating appears/disappears with the module.
- [ ] Frostfire Engine is faster on the same timed route and remains controllable.
- [ ] Expanded Cargo exposes 27 slots.
- [ ] Downgrade is refused while slots 19–27 contain items.
- [ ] Emptying high slots permits downgrade with no cargo loss.
- [ ] Aether Cannon geometry appears and one reusable control is issued.
- [ ] Reload/refit does not duplicate Cannon Controls.

### W4-S03 — cannon negative cases

Record fire/ammunition behavior for:

| Case                            | Refused correctly     | Ammo unchanged   | Useful message |
| ------------------------------- | --------------------- | ---------------- | -------------- |
| Off ship                        | [ ]                   | [ ]              | [ ]            |
| No cannon installed             | [ ]                   | [ ]              | [ ]            |
| No charges                      | [ ]                   | [ ]              | [ ]            |
| Non-owner, owner absent         | [ ]                   | [ ]              | [ ]            |
| Authorized gunner, owner aboard | n/a — should fire [ ] | one consumed [ ] | [ ]            |
| Faster than cooldown            | [ ]                   | [ ]              | [ ]            |

- [ ] Cannon Control is never consumed.

### W4-S04 — Raider, reward, and shield

- [ ] Exactly one Raider appears under the documented trigger.
- [ ] It targets/attacks and does not duplicate while active.
- [ ] Cannon shots consume one charge and clear hits apply expected damage.
- [ ] Defeat persists and the Raider does not respawn normally.
- [ ] Eligible participants receive correct reward handling.
- [ ] Exactly one Raider Core is consumed on return.
- [ ] Shield Projector is awarded safely even with a full inventory.
- [ ] Shield geometry/effect appears and cannon geometry disappears.
- [ ] Shield and Armored Hull mitigation combine as documented.
- [ ] Swapping back preserves both utility items correctly.

### W4-S05 — reload, recall, and reconstruction matrix

At each state, run save/reopen; use `/reload` where the focused plan calls for
it.

| State                              | Reopen pass | `/reload` pass | No duplicate/loss |
| ---------------------------------- | ----------- | -------------- | ----------------- |
| Advanced modules installed         | [ ]         | [ ]            | [ ]               |
| Raider active                      | [ ]         | [ ]            | [ ]               |
| Raider defeated, core not returned | [ ]         | [ ]            | [ ]               |
| Combat complete                    | [ ]         | [ ]            | [ ]               |
| Craft recalled/reconstructed       | [ ]         | [ ]            | [ ]               |

- [ ] Geometry, hull, cargo size, modules, objectives, rewards, and counters persist.
- [ ] Reconstruction preserves the blueprint but does not recreate lost cargo.

## Wave 5 — basic player-built Skycraft

Run Sessions A–E from
[`SKYCRAFT_HANDS_ON_TEST_PLAN.md`](SKYCRAFT_HANDS_ON_TEST_PLAN.md) before any
advanced reference or cap claim.

### W5-S01 — clean Apprentice berth and first raft

- [ ] Berth and walkway appear automatically and are safely reachable.
- [ ] Fresh resources support Basic Helm, Core, Lift Sail, and Coal Thruster.
- [ ] A connected build with one Helm/Core reports understandable engineering values.
- [ ] Certification and launch clear only approved connected blocks.
- [ ] Proxy mounts, flies, and docks.
- [ ] Docking restores every approved block/state at the exact relative coordinate.
- [ ] No item or block is gained or lost.
- [ ] Record arrival-to-first-launch time.

### W5-S02 — non-destructive diagnostics

For every invalid case in Skycraft Session C:

- [ ] The expected exact diagnostic appears.
- [ ] No partial clear or material consumption occurs.
- [ ] No unrelated block changes.
- [ ] Obstructed destinations fail closed.
- [ ] Stale blueprints require recertification.
- [ ] Outstanding repair bills prevent launch.

Attach one result table covering missing/duplicate Helm/Core, forbidden or
outside blocks, block/mass/lift/thrust caps, obstruction, stale blueprint, and
repair bill.

### W5-S03 — exact authority and recovery

- [ ] Docked reopen has one exact dock build.
- [ ] Immediate post-launch reopen has one authority.
- [ ] In-flight reopen has one proxy and no dock copy.
- [ ] Immediate post-dock reopen has one exact dock build.
- [ ] Missing/destroyed proxy recovers the build with the correct bill.
- [ ] Obstructed recovery fails closed and preserves the obstruction.

Both a proxy and full dock build is an immediate stop-ship failure.

### W5-S04 — reference order and personal blueprint accounting

Use the experimental tag only for this focused session.

- [ ] Missing-material order consumes nothing.
- [ ] Successful reference order consumes exactly its plan.
- [ ] Edited craft can be recertified and saved.
- [ ] `Build Saved` consumes every required block once.
- [ ] The materialized copy receives a fresh registration.
- [ ] Obstructed order rolls back inventory and world changes.

### W5-S05 — physical cargo remains inactive

- [ ] Player-built proxy exposes no physical cargo inventory.
- [ ] UI does not claim physical transfer exists.
- [ ] Launch/dock does not move container contents.

This is an expected negative gate, not acceptance of a cargo feature.

## Wave 6 — multiplayer, input, and device matrix

Use `D1`. Combine overlapping legacy-craft, Dockyard, and Skycraft checks into
one recorded device session, but identify which craft each result covers.

### W6-S01 — two-player legacy craft and Dockyard

- [ ] Test both skiff seat-entry orders.
- [ ] Pilot retains control; passenger cannot override it.
- [ ] Excess riders cannot enter.
- [ ] Both players dismount and recover safely.
- [ ] Disconnect/rejoin preserves players and craft state.
- [ ] Non-owner cannot refit or take ownership.
- [ ] Authorized gunner can fire only under documented owner conditions.
- [ ] One shared Raider state is consistent for both players.

### W6-S02 — player-built roles and authority

- [ ] Owner can edit, certify, launch, dock, recover, and assign.
- [ ] Builder, Pilot, Navigator, Gunner, Mechanic, Passenger, and Guest stay within their documented permissions.
- [ ] Excess riders are rejected/ejected safely.
- [ ] Owner disconnect does not grant unauthorized control.
- [ ] Two nearby active craft remain independent.
- [ ] Four nearby active craft are measured if the device/session supports it.
- [ ] Simultaneous Helm/Dockmaster use does not duplicate or corrupt state.

### W6-S03 — input matrix

Use `PASS`, `FAIL`, `NT`, or `BLOCKED` in every cell.

| Input/device            | Mount | Steer | Ascend/descend | UI/refit | Aim/fire | Dock/recover | Camera |
| ----------------------- | ----- | ----- | -------------- | -------- | -------- | ------------ | ------ |
| Windows keyboard/mouse  |       |       |                |          |          |              |        |
| Controller target       |       |       |                |          |          |              |        |
| Touch target            |       |       |                |          |          |              |        |
| Lowest supported device |       |       |                |          |          |              |        |

Record controller model, touch device, control mapping, dead zones, camera
clipping, form readability, approximate FPS, and any keyboard-only gesture.

## Wave 7 — advanced/gated Skycraft

Run only after Wave 5 passes and only when evaluating promotion beyond the
basic Apprentice prototype.

Source: Skycraft Sessions F–J.

- [ ] `W7-S01` Test all eight reference fixtures with the experimental tag.
- [ ] `W7-S02` Record engineering caps, blueprint bytes, launch/dock time, FPS, and tick behavior.
- [ ] `W7-S03` Validate damage, persisted repair bills, exact Repair Kit consumption, and destruction recovery.
- [ ] `W7-S04` Validate two-player and four-player roles/permissions.
- [ ] `W7-S05` Validate current progression exposure and legacy craft coexistence.
- [ ] `W7-S06` Repeat on the lowest supported device.
- [ ] `W7-S07` Keep 56/96/160/240-block caps provisional unless device and multiplayer evidence pass.

## Wave 8 — profiles and server-side tooling

### W8-S01 — GameTest profile

In a separate Beta APIs world:

```powershell
npm run local-deploy:gametest
```

```text
/gametest run skyknights:skiff_has_pilot_and_passenger_seats
```

- [ ] The named test passes.
- [ ] Stable and GameTest packs load without registry errors.
- [ ] Exactly two skiff seats are reported and seat zero controls.

### W8-S02 — BDS smoke and `SimulatedPlayer`

- [ ] Existing `npm run test:bds:smoke` passes when the configured BDS root is available.
- [ ] Record that the current smoke proves only its named component contract.
- [ ] Mark expanded `SimulatedPlayer` interaction/mounting `BLOCKED` until that bounded test exists.

Do not claim client forms, rendering, controls, or multiplayer from a BDS
component test.

### W8-S03 — custom dimension, optional

Use the experimental profile and a separate disposable world.

- [ ] Enter and leave the custom dimension.
- [ ] Validate first registration and starter placement.
- [ ] Validate `/reload`, reopen, world copy, and second-player entry/exit.
- [ ] Record failures as experimental Strategy B findings.

A failure does not block the stable void-Overworld strategy.

## Wave 9 — summon-only entity prototypes

Run this wave only when the prototype assets and commands are included in the
recorded build. Use `E1`; do not mix prototype results into stable progression
acceptance.

### W9-S01 — Aether Outrigger

Follow [`AETHER_OUTRIGGER_TEST_PLAN.md`](AETHER_OUTRIGGER_TEST_PLAN.md).

- [ ] Registration/spawn and Content Log.
- [ ] Silhouette, texture, culling, and camera.
- [ ] Two seats and both entry orders.
- [ ] Flight, collision, landing, and dismount.
- [ ] Reopen, `/reload`, cleanup, and duplicate safety.
- [ ] Record prototype-only acceptance boundary.

### W9-S02 — Steampunk Blimp

Follow [`STEAMPUNK_BLIMP_TEST_PLAN.md`](STEAMPUNK_BLIMP_TEST_PLAN.md).

- [ ] Registration/spawn and Content Log.
- [ ] Silhouette, texture, culling, and root hierarchy.
- [ ] Propeller animation at rest and in motion.
- [ ] Four seats, cameras, entry orders, and safe dismount.
- [ ] Flight, collision, landing, and handling.
- [ ] Reopen, `/reload`, cleanup, and duplicate safety.
- [ ] Multiplayer regression.
- [ ] Record prototype-only acceptance boundary.

## Wave report template

Send one report after each wave using this format:

```text
Wave:
Build commit/version:
Minecraft/device/input/players:
World ID and provenance:

PASS:
- W#-S## — evidence filename or concise observation

FAIL:
- W#-S## — exact steps, expected result, actual result
  Debug:
  Content Log:
  Evidence:
  Reproduces after reopen: yes/no/not attempted

BLOCKED / NT / NA / CARRIED:
- W#-S## — reason and any prior evidence reference

Measurements:
- FPS:
- worst hitch:
- placement/launch time:
- counts/bytes/save size:

Commands or shortcuts used:
World preserved for investigation: yes/no
```

For a failure, include the first exact error and the smallest reliable
reproduction. Do not continue into dependent waves when the prerequisite
failed.

## Completion record

| Wave | Scope                          | Result | Build/date | Evidence/defects |
| ---- | ------------------------------ | ------ | ---------- | ---------------- |
| 0    | Build/package preflight        | [ ]    |            |                  |
| 1    | Stable template and core route | [ ]    |            |                  |
| 2    | Archipelago                    | [ ]    |            |                  |
| 3    | Layout/migration safety        | [ ]    |            |                  |
| 4    | Dockyard/refit/combat          | [ ]    |            |                  |
| 5    | Basic Skycraft                 | [ ]    |            |                  |
| 6    | Multiplayer/input/device       | [ ]    |            |                  |
| 7    | Advanced Skycraft              | [ ]    |            |                  |
| 8    | Profiles/BDS/experimental      | [ ]    |            |                  |
| 9    | Entity prototypes              | [ ]    |            |                  |

For current stable island-variety readiness, Waves 0–3 are the first decision
boundary. Waves 4–6 close older milestone and platform gates. Waves 7–9 are
gated, optional, or prototype-specific and must remain separately labeled.
