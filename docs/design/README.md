# Design specs

Machine-readable design output from planning phases. These are specifications,
not implementation evidence. A spec here means the design was agreed, not that
the code exists.

| File                                                             | Slice                  | Status                                              |
| ---------------------------------------------------------------- | ---------------------- | --------------------------------------------------- |
| [`archipelago_variety_spec.json`](archipelago_variety_spec.json) | Ambient island variety | Implemented in source; Minecraft acceptance pending |
| [`CONTINENT_TERRAIN.md`](CONTINENT_TERRAIN.md)                   | Formula-generated continents | Specified; not implemented                    |

## Ambient island variety

This machine-readable specification records the frozen `0.3.8` run-2 contract.
The active `0.3.10` run-3 distribution and large-template contract is
documented in [`../PROCEDURAL_ARCHIPELAGO.md`](../PROCEDURAL_ARCHIPELAGO.md)
and ADR-020. Run 3 does not rewrite this historical input specification.

Run 2 replaced the four identical `15x10x13` ambient templates, which differed
only by palette, with five tiers, five altitude bands, and a combinable
component library.

| Tier      | Footprint  | Share of generated islands |
| --------- | ---------- | -------------------------- |
| Islet     | 11x8x9     | 35%                        |
| Standard  | 15x10x13   | 45%                        |
| Crag      | 23x18x21   | 16%                        |
| Landmark  | 39x30x35   | 4%                         |
| Continent | 150x40x150 | exactly 6 sites per world  |

Key decisions:

- The four existing ambient modules become the Standard tier **verbatim**, so
  their generated output stays byte-identical.
- Altitude spans Y 60-290 in five bands, replacing the flat Y 145-163 band that
  was the main cause of visual sameness. Continents sit lowest at base Y 96-128
  as the floor of the sky world.
- A Continent exceeds Bedrock's `64x257x64` structure limit and is therefore
  composed from 21 component structures rather than placed as one.
- The normative `-1` contract: structure void is the default everywhere outside
  the silhouette; an explicit `minecraft:air` palette index is used only to
  carve deliberately. Emitting a rectangular block of air "just to be safe"
  would carve visible air boxes out of the sky when islands are placed near
  each other.

## Correction to commit `031d615`

That commit's message states the `wip/island-variety-partial` branch contains
"off-scope damage to the Skycutter model". **That is wrong.** The changes to
`resource_packs/sk_rp/models/entity/skycutter.geo.json` and the new
`aether_outrigger.png` are the project owner's own in-progress art, which
happened to be uncommitted in the working tree when the workflow ran. No agent
touched them.

The original planning branch was reference-only. Its contract is now
implemented in the `0.3.8` source with automated review; Minecraft acceptance
remains separate. The owner's unrelated art stayed preserved throughout the
integration.

## Aether Outrigger art source

The editable Blockbench source for the summon-only Aether Outrigger prototype
is tracked at
`art_source/blockbench/aether_outrigger.geo.bbmodel`. The exported pack assets
are:

- `resource_packs/sk_rp/models/entity/aether_outrigger.geo.json`;
- `resource_packs/sk_rp/textures/entity/skyknights/aether_outrigger.png`; and
- `resource_packs/sk_rp/entity/aether_outrigger.entity.json`.

`tools/models/remodel-aether-outrigger.mjs` reapplies the reference-inspired
silhouette and exports the embedded 256×256 texture. The prototype is isolated
from owned-ship persistence and progression until its rendering, seats,
handling, multiplayer, and reload behavior pass in Minecraft.

## Steampunk Blimp art source

The separate Steampunk Blimp prototype is specified in
[`entities/steampunk_blimp/BRIEF.md`](entities/steampunk_blimp/BRIEF.md).
Its editable Blockbench source is
`art_source/blockbench/steampunk_blimp.geo.bbmodel`, with an external canonical
texture at
`resource_packs/sk_rp/textures/entity/skyknights/steampunk_blimp.png`.

`tools/models/create-steampunk-blimp.mjs` deterministically recreates the
Blockbench source and Bedrock geometry.
`tools/models/create-steampunk-blimp-texture.mjs` deterministically recreates
the 256×256 RGBA texture atlas. The entity remains summon-only until the
rendering, propeller animation, four seats, handling, reload, and multiplayer
checks in `docs/STEAMPUNK_BLIMP_TEST_PLAN.md` pass in Minecraft.
