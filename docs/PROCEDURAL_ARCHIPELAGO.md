# Procedural Archipelago Architecture

> Status: integrated in playtest build `0.3.4`; Minecraft acceptance pending.

## Decision

Sky Knights uses a hybrid Bedrock architecture:

1. a void world is the intended sky-only substrate;
2. reusable `.mcstructure` files provide island bodies and visual families;
3. a deterministic Script API planner chooses island locations and families;
4. one restart-safe generation job places and verifies one nearby island at a
   time.

This preserves the useful part of Bedrock feature generation—small authored
templates repeated into a large field—while adding the progression, migration,
and recovery guarantees the project needs.

## Current implementation

The stable pack contains four ambient structure templates:

| Family   | Structure                     | Palette identity                     |
| -------- | ----------------------------- | ------------------------------------ |
| Verdant  | `skyknights:ambient_verdant`  | grass, dirt, stone, oak vegetation   |
| Desert   | `skyknights:ambient_desert`   | red sand, sandstone, dead vegetation |
| Tundra   | `skyknights:ambient_tundra`   | snow, stone, ice, spruce vegetation  |
| Volcanic | `skyknights:ambient_volcanic` | netherrack, blackstone, basalt       |

Each template is a deterministic 15×10×13 structure with a solid canonical
body, five integrity probes, no dock, no container, no entity, and no
progression-unique block. The ambient structures are scenery foundations; they
do not replace the eight authored progression islands.

The planner in `scripts/generation/archipelago.ts` provides:

- a 57×57 bounded planning envelope, roughly 5,376 blocks across;
- more than 900 possible islands for the reference seed;
- four deterministic family clusters;
- a 460-block protected radius around the authored central realm;
- 96-block cells, conservative non-overlap, and Y=145–163 altitude bands;
- a 48-block player clearance so a new island is never stamped around an
  observer;
- compact `a1_<x>_<z>` IDs that can be rederived without storing every
  coordinate;
- lazy radius queries rather than materializing the complete plan at runtime;
- a first-release cap of 384 persisted ambient islands.

The `a1` identifier prefix is permanently paired with planner version 1.
Changing the authored-island layout version cannot move an already queued or
generated ambient island. A future layout must use a new ambient ID version.

## Runtime behavior

After the starter island, Ember Outpost, and Frostspire are ready, a sweep runs
every 40 ticks:

1. collect players in the configured archipelago dimension;
2. find the nearest ungenerated planned island within 512 horizontal blocks;
3. reject candidates within 48 horizontal blocks of any player;
4. persist one generation job;
5. load the complete target volume with a ticking area;
6. refuse to stamp over any occupied volume;
7. recheck the loaded target for players, craft, or other entities immediately
   before placement and preserve/skip that candidate if one is present;
8. place the family `.mcstructure`;
9. verify its integrity probes;
10. checkpoint and mark the island generated.

Only one global generation job runs at a time. A crash after placement but
before the checkpoint accepts an intact structure without restamping it. A
player or vanilla block found in an ungenerated target volume causes that
location to be recorded as skipped, preserving the existing blocks.

The stable target is currently `minecraft:overworld` so the add-on remains
installable without custom-dimension migration. A normal Overworld will still
have vanilla land below the high islands. The intended presentation requires a
new void source world packaged with:

```powershell
npm run world-template:void
```

This guarded command creates and scans the source with external BDS, then
writes the generated `.mctemplate` under `dist/world-template`. World databases
and packages remain generated output rather than checked-in source.

## Bedrock feature-rule comparison

Bedrock's native feature chain is valid for ordinary biome decoration:

```text
.mcstructure
  → minecraft:structure_template_feature
  → minecraft:feature_rules
  → biome selected by minecraft:biome_filter
```

The biome tag belongs under the `minecraft:tags` component:

```json
"minecraft:tags": {
  "tags": ["sky_realm"]
}
```

It is not a `minecraft:biome` component nested inside `components`.

For portable probability syntax, prefer an explicit ratio such as
`{"numerator": 1, "denominator": 20}` for a five-percent attempt. Bedrock
documentation contains examples from multiple format generations that express
decimal scatter chance differently.

Feature rules run during biome/chunk world generation. They are a good future
option for disposable vegetation, clouds, small ruins, and other ambient
decoration. They are not currently the authoritative Sky Knights island
planner because they do not provide this project's exact protected radius,
family-cluster contract, persisted cap, occupied-volume policy, or resumable
per-island transaction.

There is also no accepted project evidence yet that a Script API-registered
void dimension executes custom-biome feature rules. Microsoft's current custom
dimension sample builds platforms and places structures through Script API in
the void dimension. Sky Knights will not make the feature-pass assumption
without an in-engine proof.

## Optional feature-rule spike

A later experimental profile may compare feature rules against the Script
planner. It must remain new-world-only and non-blocking until all of these pass:

- the target custom biome actually owns every generated void chunk;
- feature rules run in a registered void dimension after close/reopen;
- four families form measurable clusters rather than uniform noise;
- no island enters the authored 460-block protected radius;
- island spacing prevents template overlap at maximum rotation;
- fast flight and multiplayer chunk entry do not create watchdog stalls;
- pack upgrades do not change already generated chunks or strand progression;
- absent or partially generated island locations can be diagnosed and
  recovered.

Even if that spike passes, feature rules should complement the persisted
planner for progression-critical islands rather than replace it.

## Template roles and large-island composition

The current four ambient templates are **standalone** islands. Their unused NBT
cells have block index `-1`, meaning “do not place a block here.” They are not
explicit `minecraft:air` cells. This non-destructive empty space behaves like a
structure-void mask and lets a template be placed without clearing everything
inside its rectangular bounds.

Future templates should declare one of three roles:

| Role         | Contract                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| `standalone` | A complete safe island with no required neighbor                                                             |
| `module`     | A cliff lobe, underside, plateau, cave, spire, bridge root, or biome cap that requires compatible connectors |
| `hybrid`     | A complete small island that is also sealed and aligned for optional modules                                 |

Large and massive islands should be deterministic **module graphs**, not one
enormous opaque structure:

1. choose a size class and silhouette grammar from the world seed;
2. reserve the complete maximum bounds before placing anything;
3. select a core or hybrid island;
4. attach lobes and vertical pieces through typed, rotation-aware connectors;
5. add a surface cap, cave/underside pieces, and one optional landmark;
6. validate connector closure, solidity, travel lanes, and the final bounds;
7. place the approved graph through resumable stages.

Structure-void cells are important because module bounds can overlap without
erasing blocks already placed by another module. They do not solve connection,
collision, or ownership by themselves. Every module needs connector metadata,
a claimed local bounding box, allowed rotations, and compatibility rules.

Explicit `minecraft:air` should be rare. It is appropriate only when a module
intentionally carves a cave or doorway inside a newly reserved, known-owned
volume. Using explicit air around an ordinary module could erase another
module, vanilla terrain, or player work.

The first modular slice should add multiple small and medium silhouettes before
attempting a massive class. Exact block/volume thresholds remain provisional
until BDS and weakest-device placement measurements exist.

## Adding an ambient island variant

1. Add a deterministic structure module under `tools/structures/`.
2. Give it a new permanent `skyknights:` structure identifier.
3. Register it in `tools/generate-structures.mjs`.
4. Add its size, probes, palette, and selection weight to the archipelago
   contract.
5. Run `npm run structures:generate`.
6. Add structure, planner, persistence-budget, and hands-on coverage.
7. Bump the ambient ID/layout version if selection changes could move or
   reinterpret an existing ID.
