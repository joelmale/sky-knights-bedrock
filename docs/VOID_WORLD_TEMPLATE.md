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
- commands and cheats enabled for the `0.3.5` GameDirectors playtest commands;
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

## Current `0.3.5` evidence

The 2026-07-27 production run used BDS `1.26.34.3` and passed:

- 13 origin/cardinal chunks, 1,277,952 blocks;
- restart and four newly generated distant diagonal chunks, 393,216 blocks;
- total 17 chunks and 1,671,168 air blocks through Y=-64..319;
- strict checks of both `level.dat` files, fixed metadata, disabled
  experiments, cleanup, and source immutability; and
- archive inspection: 118 sorted root entries, no wrapper directory, exact
  `0.3.5` Behavior/Resource Pack bindings.

The resulting file is 138,918 bytes. Its SHA-256 is
`9f9cfbf6292245df8ffb16a7fb248ed2af2f5665439c7c087b3c44c0461adb7c`.

## Client acceptance

1. Double-click `sky_knights_void_world.mctemplate`.
2. Wait for Minecraft to report a successful import.
3. Open **Play → Create New** and select **Sky Knights: Void Realm** under
   imported templates.
4. Create the world without adding the standalone `.mcaddon` a second time.
5. Wait for arrival at the starter dock.
6. Run `/skyknights:debug` and confirm the expected playtest version.
7. Explore below and beyond the authored realm and confirm there is no ordinary
   Overworld terrain.
8. Save, close, reopen, and repeat the recovery and exploration checks.
