# Stable World-Template Source

The stable add-on places authored floating-island structures in
`minecraft:overworld` around y=149. It does not and cannot switch off the
generator of an ordinary Overworld, so a world created from the normal preset
continues generating vanilla terrain below the Sky Knights structures.

The stable sky-only distribution is therefore a **new void-world template**:

1. Create a dedicated empty/void Bedrock world in Minecraft or Bedrock Editor.
2. Confirm newly explored chunks contain no ordinary Overworld land.
3. Activate the stable Sky Knights Behavior and Resource Packs.
4. Exit the world cleanly and retain an untouched backup of its folder.
5. Package a copy from the repository root:

   ```powershell
   npm run world-template -- --world "<world folder>"
   ```

The packager validates `level.dat`, leaves the source world untouched, embeds
the compiled Behavior and Resource Packs, writes the required world pack
references, and produces:

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

The separate experimental profile can register a void custom dimension, but it
remains a capability proof until Beta API, reload, copy, multiplayer, and
device gates pass.
