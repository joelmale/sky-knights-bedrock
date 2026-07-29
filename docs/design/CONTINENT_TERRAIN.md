# Continent Terrain — design spec

> Status: **specified, not implemented.** No code for this exists.
>
> Supersedes the multipart `.mcstructure` approach for continents only.
> Islets, Standards, Crags and Landmarks stay authored structures.

## Why this exists

Continents are currently assembled from 30x40x30 `.mcstructure` parts: 21 today
at a 150-block span. The owner wants 600-1,800 blocks. Scaling the current
approach does not reach that:

| Span | Parts @30 | Parts @64 | Preflight volume |
| ---- | --------: | --------: | ---------------: |
| 150 (today) | 21 | — | 900 K cells |
| 600 | ~396 | ~100 | 14.4 M cells |
| 1,200 | ~1,600 | ~361 | 57.6 M cells |
| 1,800 | ~3,600 | ~841 | 129.6 M cells |

Widening parts to Bedrock's 64-block maximum cuts placement count ~4.5x, but
the obstruction preflight is per *volume*, not per part, so it does not shrink.
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

**Idempotence removes the F1 defect class.** A part is discrete, cursor-tracked
and unrepeatable, so losing one strands it permanently — the defect fixed in
`0.3.11`, which would have recurred across 100-841 placements per continent. A
formula-generated chunk is recomputable by definition: "was this written?" is
answered by looking, and the repair is running the formula again. Same input,
same output. There is no cursor and nothing to strand.

It also collapses three constraints at once:

| Constraint | Parts | Formula |
| ---------- | ----- | ------- |
| Authored content at 1,800 blocks | ~841 structures | none |
| Preflight | 129.6 M `getBlock` | per chunk, already iterating |
| Streaming | needs a new job model | inherent to chunk generation |
| Persistence | part cursor per continent | ID only; shape is derivable |
| 600 -> 1,800 | architecture change | radius parameter |

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
5. Place decoration structures whose deterministic site falls in this chunk,
   anchored to `surfaceY`.

`Dimension.fillBlocks(volume, block, options)` is the primitive. The typings
document no volume cap, only `UnloadedChunksError`, and
`ignoreChunkBoundErrors` lets a fill cover only what is loaded — which is
exactly the streaming behaviour wanted. A 16x40x16 column band is 10,240
blocks, so a chunk costs single-digit `fillBlocks` calls per band.

**Unverified:** actual `fillBlocks` throughput in-engine. The legacy `/fill`
command capped at 32,768 blocks and `fillBlocks` may inherit an undocumented
limit. This must be measured on the weakest target device before committing to
1,800 blocks. It is the single largest risk in this design.

## Persistence

One continent costs the same as an islet: **20 bytes** — one entry in
`generatedIslandIds`, one in `islandVersions`. The shape is derivable from the
world seed and the continent index, so no per-chunk record is required.

If chunk-level bookkeeping later proves necessary, it must not be a growing
per-chunk set: that would reintroduce the persistence pressure the measured
20-bytes-per-island figure currently avoids. Prefer recomputation.

Continent count therefore does not compete with the solo-island cap.

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

1. Measure `fillBlocks` throughput in-engine. Gate the whole design on it.
2. Implement the field and its host-side tests, no Minecraft required.
3. Chunk generation for one family at 600 blocks.
4. Decoration pass reusing the run-1 library.
5. Raise to 1,200-1,800 once measured, which should be a parameter change.

Steps 1-2 are independent of the ring/cluster planner work and can proceed in
parallel.

## Open questions

- Does `fillBlocks` have an undocumented volume cap?
- Do continents need biome families, or is one continental palette enough?
- Should the authored progression islands eventually sit on continent terrain
  rather than being separate structures?
- Are 3D density caves worth the complexity over a pure height field?
