# AI Development Handoff

> Snapshot date: 2026-07-28
>
> Branch: `codex/procedural-archipelago`
>
> Source/playtest version: `0.3.8`

## Read this first

This repository uses the vendor-neutral hub-and-spoke rules in
[`../AGENTS.md`](../AGENTS.md) and
[`MULTI_AGENT_WORKFLOW.md`](MULTI_AGENT_WORKFLOW.md). One central architect
owns integration, documentation, full verification, and the final commit.
Substantial slices use bounded specialists with disjoint file ownership and an
independent read-only QA role.

The branch contains the `0.3.8` island-variety checkpoint. Generated files
under `dist/` are ignored and may be rebuilt; tracked source and documentation
are authoritative. Inspect `git status` and preserve unrelated owner-authored
work.

Read the [`VALIDATION_LOG.md`](VALIDATION_LOG.md) hands-on section before
changing starter or archipelago content. The latest Minecraft archipelago
evidence is still `0.3.6`; the `0.3.8` variety planner has host evidence but
still needs Sessions C-G in a real client.

## Product and architecture state

The current implementation includes:

- a stable TypeScript/Bedrock add-on scaffold, deterministic structure tooling,
  production `.mcaddon` packaging, opt-in experimental/GameTest profiles,
  zero-audit dependency policy, and CI-ready verification;
- the command-free starter-skiff route, Dockmaster recovery, Ember/Frostspire
  progression, Skycutter refit, Aether Cannon combat, Raider reward, and ship
  persistence/reconstruction;
- schema-5 deterministic realm state, three pinned progression islands, five
  seeded progression islands, retry/backoff generation, integrity checks,
  sticky player-modified protection, safe arrival, and recovery;
- a bounded player-built Skycraft prototype with wood airframes, Helm/Core
  scanning, mass/lift/thrust/certification rules, reference blueprints,
  authored moving proxies, roles, damage/repair, persistence, and combat;
- a bounded deterministic procedural archipelago with more than 850 solo
  candidates, four clustered visual families, four weighted size tiers, five
  altitude bands, rare bounded burn variants, six sparse continent sites,
  resumable 21-part continent placement, occupied-space protection, and
  separate 224-solo/two-continent caps; and
- a stable strategy of scripted `.mcstructure` island placement over a packaged
  void Overworld. The opt-in custom dimension and native biome feature rules
  remain experiments rather than release authority.

Authoritative detail lives in:

- [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — what is built versus pending;
- [`CHANGELOG.md`](../CHANGELOG.md) — versioned implementation history;
- [`DECISIONS.md`](DECISIONS.md) — accepted architecture contracts;
- [`VALIDATION_LOG.md`](VALIDATION_LOG.md) — checks that actually ran;
- [`CONTENT_MATRIX.md`](CONTENT_MATRIX.md) — built/planned content truth;
- [`SKYCRAFT_IMPLEMENTATION_STATUS.md`](SKYCRAFT_IMPLEMENTATION_STATUS.md) —
  Skycraft slice status and gates; and
- [`PROCEDURAL_ARCHIPELAGO.md`](PROCEDURAL_ARCHIPELAGO.md) — island-field
  planner and placement design.

## Current `0.3.8` checkpoint

### Ambient island variety

New ambient IDs use planner version `a2`. Existing `a1` terrain stays where it
was and does not consume the new caps; a valid interrupted `a1` job can still
finish against its frozen Standard template. Solo islands select Islet,
Standard, Crag, or Landmark templates across deterministic Deep, Low, Mid,
High, and Crown altitude bands.

The planner exposes six widely spaced continent sites and generates at most
two. Each continent is a 150×40×150 composition of 21 seam-safe components.
Jobs persist a monotonic part cursor, load and verify one row at a time, pause
five ticks between placements, and safely recognize a component placed just
before an interrupted cursor save.

The structure library distinguishes solo, feature, component, and dual-use
content. Structure void preserves destination blocks outside silhouettes and
at open seams; explicit air is limited to intentional carves, basins, falls,
fire standoffs, sockets, and interior seam clearance. Rare volcanic ember and
bounded oak-pyre variants are mutually exclusive and never selected for
continents.

### Starter-resource correction

The starter island supplies at least 2.5x what the command-free first-skiff
route spends, and supplies it where a player on foot can reach it: 18 iron ore,
8 coal ore, 16 oak logs across four trees, and a ten-block exposed stone
boulder beside the workshop. Six ore columns break the grass surface — four
iron and two coal — each continuing straight down, with shallow pockets three
to four blocks under the clearing. No starter ore sits on the tapered underside
or the sheer side faces.

The minimums are derived in `tools/structures/starter_island.mjs` from
`STARTER_RESOURCE_REQUIREMENTS` and a single `STARTER_RESOURCE_MARGIN`
constant, so retuning a recipe cannot quietly erode the buffer. The generator
throws if ore is placed below the reachable band, outside the body, or with
fewer than four visible iron and two visible coal outcrops.

The starter island content version remains 7. Unmodified generated islands may
rebuild; player-modified and conservatively protected islands are not silently
overwritten.

### Packaged void realm

`npm run world-template:void` now:

1. builds the production scripts;
2. creates a uniquely owned fixed-seed world with the configured external BDS
   `1.26.34.3`;
3. patches the stopped world to `Generator=2` with one explicit
   `minecraft:air` flat layer and deletes only that disposable world's
   pre-patch database;
4. reopens, finalizes, and freezes a clean source;
5. scans full-height origin/cardinal and distant chunks on a separate copy,
   including newly generated chunks after restart;
6. embeds the current stable Behavior and Resource Packs; and
7. writes `dist/world-template/sky_knights_void_world.mctemplate`.

Canonical source defaults are:

- seed `1702740741`;
- Survival (`GameType=0`, forced);
- cheats and commands enabled for `0.3.6` GameDirectors test commands;
- starter-dock spawn `(10, 161, 1)`;
- localized name **Sky Knights: Void Realm**; and
- no enabled or previously used experiments.

The packager independently rejects non-void metadata, wrong defaults, missing
finalization files, enabled experiments, and a live `session.lock`. It writes a
root `world_template` manifest, embeds the packs as `sk_bp` and `sk_rp`, and
binds their exact `0.3.6` UUID/version pairs.

See [`VOID_WORLD_TEMPLATE.md`](VOID_WORLD_TEMPLATE.md) for the build and safety
contract.

## Latest verification evidence

The `0.3.8` combined working tree passed:

```powershell
npm run verify
npm audit --audit-level=high
```

Results:

- 265 host tests across 45 files;
- all 35 generated structures, formatting, TypeScript, stable bundle, BDS NBT
  fixtures, production `.mcaddon`, and both opt-in profiles passed;
- npm reported zero vulnerabilities;
- 39 focused tests cover planner/runtime/structure/persistence/multipart
  behavior, including full-footprint preflight, stale-cursor recovery,
  checkpointed-player-edit preservation, and structure-verified safe docks.

The last BDS smoke, full-height void scan, and packaged-template evidence remain
the historical `0.3.6` results in [`VALIDATION_LOG.md`](VALIDATION_LOG.md).
They were not rerun and do not prove `0.3.8` continent placement, fire,
rendering, reload, or performance.

## What is not yet proven

Automation does not prove:

- clean-client `.mctemplate` import;
- client-side pack binding, rendering, starter generation, or automatic
  arrival after creating a world from the template;
- the complete wooden-pickaxe to stone-pickaxe to seven-ingot mining route, or
  that a first-time player finds the six visible ore outcrops without help;
- save/quit/reopen, world copy, `/reload`, schema migration, or
  player-modified island protection in a real client;
- `0.3.8` tier/altitude readability, burn behavior, continent seams,
  interrupted multipart placement, obstruction behavior, exploration pacing,
  or weakest-device performance;
- multiplayer, controller, or touch behavior; or
- the full player-built Skycraft acceptance matrix.

Do not describe these as passed until their focused hands-on sessions are
recorded in [`VALIDATION_LOG.md`](VALIDATION_LOG.md).

## What the first playtest changed

The `0.3.5` session failed on two things, both fixed in `0.3.6`:

1. **Starter iron was unreachable, not merely scarce.** The island held twelve
   iron blocks against a seven-ingot route, but ten sat on the tapered
   underside. The contract counted placed ore instead of reachable ore. Every
   starter resource now carries a uniform 2.5x margin over an explicit
   requirement table, all ore sits in the surface-reachable band, and the
   generator refuses to build an island that violates either rule.
2. **The session ran on the wrong world type.** A normal Infinite world with
   the development packs was used instead of a world created from the template,
   so the reported Overworld terrain was the documented compatibility mode.
   The packaged template was re-inspected and was correct. `/skyknights:debug`
   now opens with a `below=` line so the world type is unmistakable.

The general lesson for future contracts: assert what a player can obtain, not
what the generator emitted.

## Recommended next slice

The immediate slice should be **`0.3.8` island-variety client acceptance**, not
more archipelago content.

1. Run `npm run world-template:install` and restart Minecraft. Double-clicking
   the `.mctemplate` does nothing on this machine: no Minecraft file extension
   is registered with Windows.
2. In Minecraft, create a new world from **Sky Knights: Void Realm** under
   templates. Do not add the standalone `.mcaddon`; both packs are embedded.
3. Confirm `/skyknights:debug` reports `v0.3.8` and `below=void`, then run
   Sessions C-G of
   [`ARCHIPELAGO_HANDS_ON_TEST_PLAN.md`](ARCHIPELAGO_HANDS_ON_TEST_PLAN.md),
   recording family/tier/altitude variety, rare burns, one continent,
   save/close/reopen during continent placement, occupied-volume preservation,
   exploration pacing, and placement hitch.
4. Keep the earlier `0.3.6` Sessions A, A2, and B as historical evidence; rerun
   them only if bootstrap, starter content, or the template changes.
5. Record the Minecraft version, platform, input, exact Git commit or dirty
   checkpoint, Content Log result, and every failure before changing code.
6. Implement only reproducible import, bootstrap, progression, obstruction, or
   performance fixes. Re-run the automated gates and the failed client session.

If that slice passes, the next priorities are:

1. Phase 3 schema-4 migration and player-modified-island hands-on acceptance;
2. multiplayer and lowest-device archipelago performance;
3. Skycraft Sessions A-E for Apprentice build/certification/reconstruction;
4. Skycraft damage, combat, permissions, and legacy coexistence; then
5. content/art/biome/encounter depth for the ambient archipelago.

## Takeover checklist

```powershell
git status --short
git diff --check
npm ci
npm run verify
npm audit --audit-level=high
```

`npm ci` is necessary after a fresh clone or lockfile change; it is not needed
before every client playtest when the existing install matches
`package-lock.json`.

The BDS commands require the manually installed external server and
`SKY_KNIGHTS_BDS_ROOT`/sentinel setup described in
[`BDS_GAME_TEST_HARNESS.md`](BDS_GAME_TEST_HARNESS.md). They never download or
redistribute BDS. Do not point them at client save folders.

Before committing this checkpoint, the next central architect must:

1. review the entire inherited diff and preserve it;
2. confirm independent QA has no unresolved stop-ship finding;
3. rerun `npm run verify` and `npm audit --audit-level=high` if any source
   changes after this handoff;
4. update evidence with any Minecraft results; and
5. make one intentional checkpoint commit only when the user authorizes it.
