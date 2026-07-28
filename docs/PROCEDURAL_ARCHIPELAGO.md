# Procedural Archipelago Architecture

> Status: island-variety run 2 integrated in `0.3.8` source; Minecraft
> acceptance pending.

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

The stable pack contains a deterministic 26-template ambient library grouped by
role:

| Role         | Contents                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------- |
| Solo         | Four islets, four byte-stable Standard islands, four base crags, and four base landmarks |
| Feature      | Reusable relief, cave, lake, fall, bridge, ember-field, and bounded-pyre primitives      |
| Component    | Six 30×40×30 coast/interior parts for assembling continents                              |
| Dual         | `duo_mesa`, valid both as one solo landmark and as a continent interior                  |
| Rare variant | Volcanic crag/landmark ember fields and the landmark reactive pyre                       |

The four original `ambient_*` structures are the Standard tier and remain
byte-identical. All ambient content remains scenery-only: no authored dock,
container, custom entity, or progression-unique reward is activated by this
planner. Each template does carry safe-return metadata, verified against its
emitted block indices for solid footing and two clear blocks; continent
coordinates are translated from the logical 150×150 footprint rather than the
first component's persisted origin.

| Tier      | Footprint  | Solo roll | Placement model                                |
| --------- | ---------- | --------: | ---------------------------------------------- |
| Islet     | 11×8×9     |       35% | One cheap standalone structure                 |
| Standard  | 15×10×13   |       45% | One original byte-stable ambient structure     |
| Crag      | 23×18×21   |       16% | One peaked/cavern structure                    |
| Landmark  | 39×30×35   |        4% | One large feature-rich structure               |
| Continent | 150×40×150 |  separate | Twenty-one resumable parts on six sparse sites |

The planner in `scripts/generation/archipelago.ts` provides:

- a 57×57 bounded planning envelope, roughly 5,376 blocks across;
- more than 850 possible solo islands for the reference seed;
- four deterministic family clusters;
- a 460-block protected radius around the authored central realm;
- 96-block cells and per-tier clearance radii with at least 12 blocks between
  reserved silhouettes;
- five overlapping altitude bands spanning origin Y=60–290, with the highest
  structures clamped to top Y=314;
- six deterministic continent sites on a jittered ring roughly 2,300 blocks
  from the center, with a 5×5-cell suppression zone around each;
- per-island observer clearance from 48 blocks for small islands to 137 blocks
  for continents;
- compact `a2_<x>_<z>` IDs that can be rederived without storing every
  coordinate;
- lazy radius queries rather than materializing the complete plan at runtime;
- separate lifetime caps of 224 solo islands and two continents.

The `a1` identifier prefix remains permanently paired with the original flat
planner. Existing `a1` terrain and generated IDs stay intact but become inert:
the new planner neither relocates nor restamps them. Run 2 uses `a2`, and a
future selection change that reinterprets coordinates must use another prefix.

Altitude is deterministic integer math. Each solo tier chooses from a weighted
subset of deep, low, mid, high, and crown bands, then applies a small
coordinate-derived ridge term so neighboring cells slope together instead of
forming unrelated shelves. Continents occupy base Y=96–128 as the low floor of
the world.

Only volcanic crags and landmarks evaluate burn gates. The eternal ember gate
is checked first at 1-in-8; only a miss can reach the 1-in-16 reactive-pyre
gate, which is landmark-only. The variants therefore cannot coincide, remain
under two percent of the full plan, and never appear on a continent.

## Runtime behavior

After the starter island, Ember Outpost, and Frostspire are ready, a sweep runs
every 40 ticks:

1. collect players in the configured archipelago dimension;
2. find the nearest ungenerated planned island within 512 horizontal blocks;
3. reject candidates inside that island's per-tier observer clearance;
4. persist one generation job;
5. load the complete solo target, or preflight every remaining continent part
   one row at a time;
6. refuse to stamp any continent part if a later remaining part is already
   occupied, so no partial continent is created;
7. recheck each loaded target for players, craft, blocks, or other entities
   immediately before placement and preserve/skip that candidate if one is
   present;
8. place the resolved solo structure, or resume the continent at its persisted
   part cursor with five ticks between parts;
9. verify the solo probes, or each newly handled part while its row remains
   loaded without retry-gating earlier checkpointed player edits;
10. checkpoint and mark the island generated.

Only one global generation job runs at a time. A crash after placement but
before the checkpoint accepts an intact structure without restamping it. A
continent persists its next-part cursor after every component, so a restart
recognizes a valid placement made just before a missed cursor save and never
treats a partial continent as finished. A player or vanilla block found in any
ungenerated target volume causes that location to be recorded as skipped,
preserving the existing blocks.

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

Every new structure follows the normative `-1` contract:

- palette index `-1` is structure void and leaves the existing world untouched;
- the final palette entry is explicit `minecraft:air` and force-clears only a
  declared cave, chasm, basin headroom, fall column, socket, fire standoff, or
  continent seam interior;
- solo air may never escape the island silhouette;
- every solo structure keeps at least 70% of its rectangular volume as
  structure void.

Continents tile 30×40×30 parts edge-to-edge with zero overlap. A frozen border
shell makes every interior seam share the same core, surface, and cleared
headroom profile; features cannot write into that shell except through the one
fixed bridge-abutment window. The four 5×5 grid corners are omitted, twelve
rotated coast parts round the perimeter, and nine interior slots guarantee a
central ridge, at least two lakes, one chasm, and one bridge.

`duo_mesa` is the only dual-role structure. Its seam shell reads as an
intentional cliff when placed alone and aligns with the same frozen component
contract when selected inside a continent.

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
