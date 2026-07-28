# AI Development Handoff

> Snapshot date: 2026-07-27
>
> Branch: `codex/procedural-archipelago`
>
> HEAD before the current uncommitted checkpoint: `f92d9c8`
>
> Playtest version: `0.3.5`

## Read this first

This repository uses the vendor-neutral hub-and-spoke rules in
[`../AGENTS.md`](../AGENTS.md) and
[`MULTI_AGENT_WORKFLOW.md`](MULTI_AGENT_WORKFLOW.md). One central architect
owns integration, documentation, full verification, and the final commit.
Substantial slices use bounded specialists with disjoint file ownership and an
independent read-only QA role.

The working tree intentionally contains an integrated, uncommitted `0.3.5`
checkpoint. Do not reset, clean, regenerate, or overwrite it before reviewing
`git status`, `git diff`, and this document. Generated files under `dist/` are
ignored and may be rebuilt; tracked source and documentation are authoritative.

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
- a bounded deterministic procedural archipelago with more than 900 candidate
  cells, four clustered visual families, lazy one-job placement, occupied-space
  protection, and a 384-outcome persistence cap; and
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

## Current uncommitted `0.3.5` checkpoint

### Starter-resource correction

The starter island now has a five-block exposed stone boulder beside the
workshop. It complements the visible surface iron/coal prospect, two oak trees,
crafting table, and furnace so the player can make a wooden pickaxe, mine three
cobblestone, make a stone pickaxe, and reach the first ship without guessing
where stone is buried.

The starter island content version is 6 and package/pack versions are `0.3.5`.
Unmodified generated islands may rebuild; player-modified and conservatively
protected islands are not silently overwritten.

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
- cheats and commands enabled for `0.3.5` GameDirectors test commands;
- starter-dock spawn `(10, 161, 1)`;
- localized name **Sky Knights: Void Realm**; and
- no enabled or previously used experiments.

The packager independently rejects non-void metadata, wrong defaults, missing
finalization files, enabled experiments, and a live `session.lock`. It writes a
root `world_template` manifest, embeds the packs as `sk_bp` and `sk_rp`, and
binds their exact `0.3.5` UUID/version pairs.

See [`VOID_WORLD_TEMPLATE.md`](VOID_WORLD_TEMPLATE.md) for the build and safety
contract.

## Latest verification evidence

The current integrated working tree passed:

```powershell
npm run world-template:void
npm run verify
npm audit --audit-level=high
npm run test:bds:smoke
```

Results:

- 228 host tests across 40 files;
- generated structures, formatting, TypeScript, stable bundle, BDS NBT
  fixtures, production `.mcaddon`, and both opt-in profiles passed;
- npm reported zero vulnerabilities;
- the named BDS skiff-seat GameTest passed;
- the void runner checked 17 chunks and 1,671,168 blocks through Y=-64..319
  across two boots; every checked block was air;
- source SHA-256:
  `a299a218ee146c607bb6735bbf3fcd343a1f623f657151948e50c074b12577b2`;
- the final `.mctemplate` is 138,918 bytes with 118 sorted root entries, no
  wrapper folder, and SHA-256
  `9f9cfbf6292245df8ffb16a7fb248ed2af2f5665439c7c087b3c44c0461adb7c`.

The generated import file is:

```text
dist/world-template/sky_knights_void_world.mctemplate
```

## What is not yet proven

Automation does not prove:

- clean-client `.mctemplate` import;
- client-side pack binding, rendering, starter generation, or automatic
  arrival after creating a world from the template;
- the visible boulder's complete wooden-pickaxe to stone-pickaxe mining route;
- save/quit/reopen, world copy, `/reload`, schema migration, or
  player-modified island protection in a real client;
- archipelago clustering, obstruction behavior, exploration pacing, or
  weakest-device performance;
- multiplayer, controller, or touch behavior; or
- the full player-built Skycraft acceptance matrix.

Do not describe these as passed until their focused hands-on sessions are
recorded in [`VALIDATION_LOG.md`](VALIDATION_LOG.md).

## Recommended next slice

The immediate slice should be **Void Realm client acceptance and first-flight
progression closure**, not more content.

1. Double-click
   `dist/world-template/sky_knights_void_world.mctemplate`.
2. In Minecraft, create a new world from **Sky Knights: Void Realm** under
   imported templates. Do not add the standalone `.mcaddon`; both packs are
   embedded.
3. Run Sessions A-C of
   [`ARCHIPELAGO_HANDS_ON_TEST_PLAN.md`](ARCHIPELAGO_HANDS_ON_TEST_PLAN.md),
   including automatic starter arrival, `Sky Knights debug v0.3.5`, no vanilla
   land, starter boulder/iron/coal visibility, first pickaxes, first skiff, and
   nearby/distant island generation.
4. Save, close, reopen, and run the persistence/obstruction checks in Sessions
   D-F.
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

