# Continent Terrain — design spec

> Status: **600-block terrain and streaming implemented; Minecraft acceptance
> pending.** Decoration, additional families, caves, and 1,200–1,800-block
> promotion remain gated.
>
> Supersedes new multipart `.mcstructure` placement for continents only.
> Existing and interrupted `a2` continents remain supported. Islets, Standards,
> Crags and Landmarks stay authored structures.

## Why this exists

Continents are currently assembled from 30x40x30 `.mcstructure` parts: 21 today
at a 150-block span. The owner wants 600-1,800 blocks. Scaling the current
approach does not reach that:

| Span        | Parts @30 | Parts @64 | Preflight volume |
| ----------- | --------: | --------: | ---------------: |
| 150 (today) |        21 |         — |      900 K cells |
| 600         |      ~396 |      ~100 |     14.4 M cells |
| 1,200       |    ~1,600 |      ~361 |     57.6 M cells |
| 1,800       |    ~3,600 |      ~841 |    129.6 M cells |

Widening parts to Bedrock's 64-block maximum cuts placement count ~4.5x, but
the obstruction preflight is per _volume_, not per part, so it does not shrink.
The measured cost today is already 180,000 `getBlock` calls in a single tick for
one 21-part continent. 129.6 M is roughly two minutes of pure scanning.

Authoring is the other wall: 841 hand-made parts per continent palette is not a
tuning problem, it is a content-production problem.

## The approach

Generate the landmass from a **deterministic formula** evaluated per chunk, and
use the existing `.mcstructure` library as **decoration** on top.

```text
formula  -> landmass, coastline, elevation, strata, lakes, cliffs
structures -> spires, groves, ruins, arches, bridges, cave mouths
```

Mass is computed; character is authored. Neither is asked to do the other's job.

### Why this is better than more parts

**Idempotence contains the multipart cursor defect class.** A structure part is
discrete and can be stranded after placement but before its cursor advances.
A formula chunk is recomputable from the same input. The runtime keeps only a
fixed completion bitset and one exact in-flight chunk index; after interruption
it replays that chunk with an air-only filter, then advances the bit. There is
no growing part list and no ambiguous jump to a different chunk.

It also collapses three constraints at once:

| Constraint                       | Parts                     | Formula                      |
| -------------------------------- | ------------------------- | ---------------------------- |
| Authored content at 1,800 blocks | ~841 structures           | none                         |
| Preflight                        | 129.6 M `getBlock`        | per chunk, already iterating |
| Streaming                        | needs a new job model     | inherent to chunk generation |
| Persistence                      | part cursor per continent | ID only; shape is derivable  |
| 600 -> 1,800                     | architecture change       | radius parameter             |

## Shape

All integer arithmetic, matching the determinism rule the structure generators
already follow: no `Math.random`, no floats whose drift could differ between
clients.

```text
surfaceY(x, z) =
    baseY
  + amplitude * falloff(warpedDistance(x, z))
  + ridge(x, z)

warpedDistance(x, z) = distance to centre, displaced by low-frequency
                       value noise, so the coastline is not a circle
falloff(d)           = 1 near the centre, 0 past the radius; the zero
                       crossing IS the coastline
ridge(x, z)          = higher-frequency detail for relief
```

- **Domain warping** is what produces bays, peninsulas and inlets. Without it a
  radial falloff yields a disc.
- **The coastline is emergent**, at `falloff = 0`, so the continent ends
  naturally instead of at a bounding box.
- **Lakes** are a second low-frequency field thresholded against `surfaceY`.
- **Overhangs and caves** need a 3D density term rather than a height field;
  treat as a later addition, not part of the first slice.

`surfaceY(x, z)` is the public API of the field. Everything downstream — strata
fill, decoration anchoring, dock placement, the safe-arrival check — reads it.

## Generation

Per chunk, on approach:

1. Compute `surfaceY` for the chunk's 256 columns.
2. Skip immediately if every column is outside the falloff — the common case
   near a continent's edge.
3. `fillBlocks` each strata band as a volume:
   - core from `baseY` to `surfaceY - subsurfaceDepth`
   - subsurface band
   - surface layer
4. Carve lakes, then fill them.
5. A later pass may place decoration structures whose deterministic site falls
   in this chunk, anchored to `surfaceY`.

`Dimension.fillBlocks(volume, block, options)` is the primitive. BDS
`1.26.34.3` established the actual contract:

- 32,768 blocks succeeds and an explicit 32,769-block volume throws;
- a 16×40×16 volume averaged 6 ms across six samples on the test host;
- four 8,192-block fills and one 32,768-block fill had effectively equal
  measured cost; and
- both values of `ignoreChunkBoundErrors` threw across an unloaded span.

Runtime therefore loads one whole chunk through a ticking area, rejects a
chunk or volume above 32,768 blocks, and issues at most four fill calls per
tick. It never relies on partial loaded-chunk behavior. Weakest-client
measurement is still required before increasing the span beyond 600 blocks.

## Persistence

Completed continent identity still costs one `generatedIslandIds` entry and
one `islandVersions` entry. Streaming progress is stored separately under the
permanent `skyknights:continent_progress_v1` key so world schema 5 and its
solo-island budget do not change.

Progress is fixed, not a growing per-chunk set. A 600-block site has 1,444
conservative chunk slots and an exact 181-byte bitset; only started sites are
stored, and the shared legacy/formula lifetime cap remains two. One exact
in-flight `{continentId, chunkIndex}` is persisted before fills begin.
Malformed schema, seed, field version, IDs, base64, length, or unused bits
fails closed.

Writes include air only. A new occupied chunk is recorded as skipped rather
than overwritten; an interrupted in-flight chunk may resume the same formula
task, still without replacing any non-air block.

An entity-occupied chunk receives a runtime-only 200-tick cooldown while the
scheduler considers alternate incomplete chunks. Infrastructure or fill
failures back off the whole formula service for 200 ticks, allowing the solo
island scheduler to run before the exact formula task is retried.

## Territory

A continent claims 2-5 adjacent cluster slots on its ring, but occupies only
the middle of them. The difference is guaranteed open sky.

- **Territory**: reserved ring slots; no other cluster generates there.
- **Footprint**: the landmass, 600-1,800 blocks.
- **Margin**: the remainder, deliberately empty.

The margin is not waste. It is what makes a continent read as dominant rather
than merely large, and it supplies the open-air ocean that separates
archipelagos.

At 40+ blocks tall against 52-block deck spacing, a continent also blocks
vertical stacking through its column. An ordinary cluster shares its ground
with other altitude decks; a continent owns its column. That is an emergent
reason it feels different, not a special case in code.

## What stays authored

The run-1 structure library becomes the decoration palette: spires, groves,
ruins, arches, land bridges, cave mouths. Placement is deterministic per site,
anchored to `surfaceY`, and the `-1` void contract still applies — decorations
must not carve air into terrain they did not intend to.

Islets, Standards, Crags and Landmarks are unaffected. They are small enough
that parts are not a problem, and hand-authoring gives them character a formula
will not.

## Testing

The formula is more testable than the structures it replaces, not less. Without
Minecraft, assert:

- determinism: identical output for a seed across repeated evaluation;
- integer-only arithmetic, no float drift at large coordinates;
- coastline closure: falloff reaches zero within the declared radius;
- no floating blocks: every solid column is continuous from base to surface;
- lakes are sealed: no lake cell adjacent to a coastline cell below its level;
- decoration anchors sit on `surfaceY`, never buried or floating;
- block budget per chunk stays under the placement ceiling.

Byte-identity of `.mcstructure` output is replaced by field-property assertions,
which cover more of what actually matters.

## Sequencing

1. **Complete:** measure `fillBlocks` cap, loaded-chunk behavior, and baseline
   throughput in BDS.
2. **Complete:** implement the deterministic field and host-side contracts.
3. **Complete in source:** stream one Verdant material family at 600 blocks
   with fixed progress and migration-safe IDs.
4. **Pending:** Minecraft appearance, approach pacing, interruption,
   player-build, multiplayer, and weakest-device acceptance.
5. **Pending:** decoration pass reusing the authored library.
6. **Pending:** raise to 1,200–1,800 only after step 4 evidence.

## Open questions

- Do continents need biome families, or is one continental palette enough?
- Should the authored progression islands eventually sit on continent terrain
  rather than being separate structures?
- Are 3D density caves worth the complexity over a pure height field?
