# Phase 3 Stabilization Hands-On Test Plan

Use this plan for the deterministic-layout and schema-5 foundation checkpoint.
The five new islands are packaged as `structure_only`; this plan verifies that
they remain inactive until their items, entities, encounters, and progression
are implemented.

## Test record

| Field | Value |
| --- | --- |
| Add-on commit | |
| Package version | `0.2.0` development checkpoint |
| Minecraft build | |
| Platform/input | |
| Fresh-world name | |
| Upgraded schema-4 world name | |
| Tester/date | |

Back up the upgraded world before opening it with this build. Do not use a
valued world as the interruption or forced-regeneration test world.

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

1. Create a fresh supported Sky Knights world.
2. Wait for initial placement to finish.
3. Run `/skyknights:debug`.
4. Inspect the starter island, Dockmaster, Ember Outpost, and Frostspire.

Expected:

- starter island is solid and the player arrives at the safe dock;
- Dockmaster appears and remains available after reload;
- the original three islands generate in their established locations with
  their guaranteed content;
- `activeJob=none` after generation finishes;
- none of the five structure-only islands is automatically placed.

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

The developer `/skyknights:island` command is an explicit forced recovery and
is allowed to replace terrain; do not use it in this protection test.

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

1. Start an explicit starter-island recovery with `/skyknights:island`.
2. Exit while `activeJob` reports `queued` or `structure_placed`.
3. Reopen the world and wait for recovery.
4. Run `/skyknights:debug` and inspect the island.

Expected:

- the persisted job resumes rather than duplicating;
- `activeJob` eventually returns to `none`;
- integrity checks pass;
- the guaranteed chest and tagged entities are not duplicated.

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

For a failure, record the exact commit, world provenance, debug output,
Content Log excerpt, reproduction steps, and whether the world was fresh,
upgraded, modified, or disposable.
