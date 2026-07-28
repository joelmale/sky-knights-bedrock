# Void-World Template

## Distribution decision

The stable Sky Knights experience is distributed as a Bedrock world template,
not as an add-on that attempts to replace an existing world's generator.

The template contains:

- a verified flat Overworld whose only terrain layer is
  `minecraft:air`;
- the stable Sky Knights Behavior and Resource Packs;
- world pack bindings that activate both packs in every world created from the
  template; and
- the normal Sky Knights runtime, which places the authored realm and lazily
  extends the procedural archipelago.

A normal world with the standalone `.mcaddon` remains a supported development
compatibility mode. It retains Minecraft terrain beneath the high islands.

## The mistake this template is easy to make

Installing the add-on is not the same as using the template. The `0.3.5`
playtest created a normal **Infinite** world with the development packs and
reported that ordinary Overworld terrain still generated. That is the
documented compatibility mode behaving exactly as designed — the template had
never been imported.

The two paths are:

| Path                                          | Terrain below the realm | Use for                    |
| --------------------------------------------- | ----------------------- | -------------------------- |
| World created from `sky_knights_void_world.mctemplate` | Empty void       | Intended presentation, all archipelago acceptance |
| Normal world plus `.mcaddon` or `local-deploy` dev packs | Vanilla terrain | Iteration and compatibility checks only |

Since `0.3.6`, `/skyknights:debug` reports which one you are in:

```text
below=void (54 probes clear)
below=§cvanilla terrain§r (31/54 probes solid — not the void template)
```

Check that line before spending a session on presentation, clustering, or
exploration pacing. A running `local-deploy --watch` keeps the development
packs installed, so they remain selectable in every world and are easy to
enable by reflex.

## Automated build

The local production command is:

```powershell
npm run world-template:void
```

It requires the same external, sentinel-approved BDS installation configured
for `npm run test:bds:smoke`. It does not download or redistribute BDS and does
not read, edit, copy, or delete client worlds.

The build:

1. creates a uniquely owned disposable BDS world;
2. stops the server before changing world metadata;
3. records `Generator=2` and one explicit `minecraft:air` flat layer in both
   level metadata files;
4. removes only the disposable world's pre-patch database so ordinary terrain
   cannot survive;
5. reopens the world with BDS and freezes a source copy;
6. scans full-height chunks near the origin and at distant coordinates on a
   separate validation copy, including new chunks after restart;
7. embeds the compiled stable packs under short, console-safe directory names;
8. writes the world-template manifest and localization files; and
9. creates:

```text
dist/world-template/sky_knights_void_world.mctemplate
```

The frozen source and validation artifacts are generated build output and are
not committed.

The packaged source defaults are deliberate:

- fixed seed `1702740741`;
- Survival mode;
- commands and cheats enabled for the `0.3.6` GameDirectors playtest commands;
- spawn `(10, 161, 1)` at the starter island's safe dock;
- no enabled or previously used experiments; and
- localized world name **Sky Knights: Void Realm**.

## Safety and reproducibility

- BDS must remain outside the repository.
- The BDS root must contain the repository's explicit test sentinel.
- The void workflow uses its own lock, world names, ports, pack staging paths,
  and retained logs.
- A surviving owned BDS process blocks cleanup.
- `server.properties` is restored even after a failed run.
- The pre-patch database is removed only from the exact runner-owned world
  while BDS is stopped.
- Validation runs on a copy; the frozen package source is hashed and never
  opened again.
- Template UUIDs are stable and distinct from the embedded pack UUIDs.
- Archive entries are sorted, and the archive contains no extra wrapper
  directory.
- Archive entries carry a fixed timestamp, so packaging identical content
  twice produces a byte-identical file and the recorded SHA-256 is meaningful.

## What automation proves

The BDS gate proves that:

- the approved BDS version retains the flat-air generator metadata;
- normal chunks from the bootstrap boot were removed;
- origin and distant chunks contain only air through the complete Overworld
  height range;
- newly generated chunks remain void after restart;
- the packaged archive contains a valid world-template module, localization,
  embedded packs, and matching world pack references; and
- the source world was not changed during packaging.

It does not prove Minecraft client import, client rendering, controller/touch
behavior, or multiplayer. Those remain hands-on acceptance gates.

## Current `0.3.6` evidence

The 2026-07-27 production run used BDS `1.26.34.3` and passed:

- 13 origin/cardinal chunks, 1,277,952 blocks;
- restart and four newly generated distant diagonal chunks, 393,216 blocks;
- total 17 chunks and 1,671,168 air blocks through Y=-64..319;
- strict checks of both `level.dat` files, fixed metadata, disabled
  experiments, cleanup, and source immutability; and
- archive inspection: 118 sorted root entries, no wrapper directory, exact
  `0.3.6` Behavior/Resource Pack bindings.

The resulting file is 139,426 bytes. Its SHA-256 is
`a05a446df94776161dc9e1c4efb6bb2ea984b8bcd8773d1a6ec252b821326811`.

The `0.3.5` archive was independently re-inspected after the failed playtest.
It carried `Generator=2`, one `minecraft:air` layer, no pre-generated chunks,
and correct pack bindings, so the packaged template was not the cause of the
Overworld terrain that session reported.

The manifest contract now reads its expected version from `package.json`
instead of a hard-coded literal, so a version bump no longer breaks packaging.

## Client acceptance

1. Double-click `sky_knights_void_world.mctemplate`.
2. Wait for Minecraft to report a successful import.
3. Open **Play → Create New** and select **Sky Knights: Void Realm** under
   imported templates.
4. Create the world without adding the standalone `.mcaddon` a second time.
5. Wait for arrival at the starter dock.
6. Run `/skyknights:debug` and confirm `v0.3.6` and `below=void`.
7. Explore below and beyond the authored realm and confirm there is no ordinary
   Overworld terrain.
8. Save, close, reopen, and repeat the recovery and exploration checks.
