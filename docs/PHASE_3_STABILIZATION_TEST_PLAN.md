# Phase 3 Stabilization Hands-On Test Plan

Use this plan for the deterministic-layout and schema-5 foundation checkpoint.
The five new islands are packaged as `structure_only`; this plan verifies that
they remain inactive until their items, entities, encounters, and progression
are implemented.

## Test record

| Field                        | Value                                                |
| ---------------------------- | ---------------------------------------------------- |
| Add-on commit                |                                                      |
| Package version              | `0.3.1` bootstrap/resource corrective playtest build |
| Minecraft build              |                                                      |
| Platform/input               |                                                      |
| Fresh-world name             |                                                      |
| Upgraded schema-4 world name |                                                      |
| Tester/date                  |                                                      |

Back up the upgraded world before opening it with this build. Do not use a
valued world as the interruption test world.

## Automated prerequisite

From a clean worktree at the test commit:

```powershell
npm ci
npm run verify
npm audit --audit-level=high
```

Expected:

- generated structures report `Verified`, not regenerated;
- formatting, TypeScript, host tests, packaging, and profiles pass;
- npm reports zero high-severity vulnerabilities;
- `dist/packages/sky_knights.mcaddon` is produced.

When the documented external BDS `1.26.34.3` test root is configured, also run:

```powershell
npm run test:bds:smoke
```

Expected: both packs load without content errors and the named skiff-seat
GameTest emits its exact pass marker. This is a server-side preflight for one
component contract; it does not replace any session below.

## Session A — Pack startup and registry validation

1. Deploy or import the package built from the recorded commit.
2. Open a disposable Sky Knights world with both packs enabled.
3. Inspect the Content Log.
4. Run `/skyknights:debug`.

Expected:

- no missing entity, item, or structure identifier;
- no script exception;
- debug reports `schema=5`, `profile=standard`, and `layoutVersion=1`;
- `layoutRecords=8`;
- every `layout:<id>` line has one stable origin;
- only the original gameplay-ready islands are generated or queued.

## Session B — Schema-4 upgrade safety

1. Back up a `0.2.0` schema-4 world containing the starter island, Ember
   Outpost, Frostspire, ships, cargo, modules, and Raider state.
2. Record visible player-built blocks and chest/cargo contents.
3. Open the copy with the Phase 3 build.
4. Run `/skyknights:debug`, leave the world, reopen it, and run the command
   again.

Expected:

- world schema migrates from 4 to 5 exactly once;
- player and ship schemas remain 3;
- generated-island IDs, versions, active job, Raider state, owned ship,
  modules, cargo, and objectives are preserved;
- the three released islands remain at their original coordinates;
- `worldSeed`, profile, layout version, and all eight layout origins remain
  identical after reload;
- no existing terrain or player-built block is restamped during migration.

## Session C — Fresh-world bootstrap

Create three fresh, disposable supported Sky Knights worlds. Do not run
`/skyknights:island`, `/skyknights:recover`, `/skyknights:skiff`, or any item,
teleport, or generation shortcut to establish the route. `/skyknights:debug` is
evidence only and must not be used to repair or advance bootstrap.

For each world:

1. Record the entry time, initial location, and the Content Log from entry.
2. Enter normally and wait for automatic first-player arrival at the safe dock.
3. Record `/skyknights:debug` after arrival and while generation progresses.
4. Wait for the automatic sequence to finish, then inspect the starter island,
   Dockmaster, Ember Outpost, and Frostspire.
5. Confirm two visible oak trees (8 logs), 12 exposed iron ore, 8 exposed coal
   ore, abundant stone, and the placed crafting table/furnace.
6. Complete the released route without developer shortcuts: gather starter
   materials, build the skiff, obtain Ember's Aether Crystal, assemble the
   Skycutter, and obtain Frostspire Froststeel.

Expected:

- starter island is solid and the player arrives at the safe dock;
- a visibly placed starter is not sufficient: its integrity checkpoint must
  complete, `activeJob` must advance, and automatic arrival/recovery must no
  longer defer once the dock is ready;
- Dockmaster appears and remains available after reload;
- the original three islands generate in their established locations with
  their guaranteed content;
- debug shows the single persisted job progressing in order through
  `starter_island`, `ember_outpost`, and `frostspire`, then `activeJob=none`;
- final debug reports exactly `starter_island,ember_outpost,frostspire` as the
  generated released islands and records all eight layout records;
- `activeJob=none` after generation finishes;
- none of the five structure-only islands is automatically placed.

Fail this session if the starter appears only after `/skyknights:island`, the
player must use `/skyknights:recover` to reach the dock, Ember or Frostspire is
absent after the bootstrap wait, or the progression route requires a developer
shortcut. Record the exact command use, location, debug output, and Content Log
excerpt; do not record a recovered run as a pass.

## Session D — Player-modified island protection

1. In the disposable fresh world, place a distinctive block inside the starter
   island's original structure volume.
2. Break a different original island block.
3. Run `/skyknights:debug`.
4. Leave and reopen the world twice.

Expected:

- debug includes `starter_island` in `playerModified`;
- its layout line changes from `authored` to `modified`;
- the distinctive block and the broken-block change survive both reloads;
- normal startup does not queue a content-version restamp over that island.

`/skyknights:island` is a safe bootstrap-resume command. It must not replace
player-modified terrain; do not use it in this protection test.

## Session E — Structure-only activation gate

1. Remain in the fresh world for at least two recovery intervals.
2. Fly the existing progression route and run `/skyknights:debug` periodically.
3. Inspect the Content Log.

Expected:

- `sunspire_reach`, `verdant_hollow`, `glacier_vault`, `ashfall_crater`, and
  `aether_sanctum` have persisted layout records but are not generated;
- no job for those IDs appears;
- no missing goblin, hedgehog, Yeti, Demon, Giant, Lorekeeper, Relic Shard, or
  Aether Core error occurs;
- the existing Ember/Frost progression remains usable.

## Session F — Interrupted placement recovery

Use a disposable world without valued building:

1. Create a fresh disposable world and allow automatic bootstrap to begin; do
   not invoke `/skyknights:island`.
2. Exit while the automatically created job reports `queued` or
   `structure_placed`.
3. Reopen the world and wait for automatic recovery.
4. Run `/skyknights:debug` only to record state and inspect the island.

Expected:

- the persisted job resumes rather than duplicating;
- `activeJob` eventually returns to `none`;
- integrity checks pass;
- the guaranteed chest and tagged entities are not duplicated.
- Ember Outpost and Frostspire automatically continue after starter completion.

## Session G — Existing gameplay regression

Run the critical path from the current
[`DOCKYARD_REFIT_COMBAT_TEST_PLAN.md`](DOCKYARD_REFIT_COMBAT_TEST_PLAN.md):

- Dockmaster interaction;
- starter skiff assembly, mounting, and flight;
- Ember Aether Crystal;
- Skycutter assembly and cargo;
- Froststeel expedition;
- at least one dockyard module swap;
- cannon fire and Raider encounter recovery.

Expected: schema-5/layout changes do not alter the released `0.2.0` gameplay
loop.

## Acceptance

- [ ] Automated prerequisite passes from the recorded commit.
- [ ] Content Log is clean.
- [ ] Fresh schema-5 world passes.
- [ ] Schema-4 migration copy passes and retains all state.
- [ ] Layout origins remain stable across reloads.
- [ ] Player block edits set and retain modification protection.
- [ ] Five structure-only islands remain inactive.
- [ ] Interrupted placement resumes safely.
- [ ] Existing progression regression passes.

`0.3.1` status: automated verification is pending separately; all Minecraft
hands-on rows above remain pending until this plan is executed and evidenced.

For a failure, record the exact commit, world provenance, debug output,
Content Log excerpt, reproduction steps, and whether the world was fresh,
upgraded, modified, or disposable.
