# Stable World-Template Source

The stable add-on places authored floating-island structures in
`minecraft:overworld` around y=149. It does not and cannot switch off the
generator of an ordinary Overworld, so a world created from the normal preset
continues generating vanilla terrain below the Sky Knights structures.

The stable sky-only distribution is therefore a **new void-world template**.
The preferred path is now the automated, BDS-validated build:

```powershell
npm run world-template:void
```

This command creates and validates a disposable source world without touching
the Minecraft client's save folders. See
[`../docs/VOID_WORLD_TEMPLATE.md`](../docs/VOID_WORLD_TEMPLATE.md).

The direct packager remains available for the canonical generated source:

```powershell
npm run world-template -- --world "dist/world-template/source"
```

This low-level command is not a shortcut for an arbitrary client-created
"empty" world. It strictly requires the fixed seed, canonical air-layer
generator, Survival/debug defaults, starter-dock spawn, disabled experiments,
matching `level.dat_old` and `levelname.txt`, and no live `session.lock`. Use
`npm run world-template:void` to create that source safely.

The packager leaves its accepted source untouched, embeds the compiled Behavior
and Resource Packs, writes the required world pack references, and produces:

```text
dist/world-template/sky_knights_void_world.mctemplate
```

Importing the `.mctemplate` adds an imported template in Minecraft. Creating a
world from that template gives each tester a new copy.

World databases are intentionally not committed here. Record the source
world's game version and SHA-256 hash with release evidence. Do not clear,
relocate, or convert an existing normal-Overworld test world: player builds and
generated terrain must be preserved. The existing add-on-only path remains a
development compatibility mode, while the template is the intended sky-only
experience.

The separate experimental profile can register a void custom dimension through
the current stable API, but that profile remains a capability proof until its
migration, reload, copy, multiplayer, and device gates pass.
