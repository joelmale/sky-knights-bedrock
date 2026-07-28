# Design specs

Machine-readable design output from planning phases. These are specifications,
not implementation evidence. A spec here means the design was agreed, not that
the code exists.

| File                                                             | Slice                  | Status                                              |
| ---------------------------------------------------------------- | ---------------------- | --------------------------------------------------- |
| [`archipelago_variety_spec.json`](archipelago_variety_spec.json) | Ambient island variety | Implemented in source; Minecraft acceptance pending |

## Ambient island variety

Replaces the four identical `15x10x13` ambient templates, which differed only
by palette, with five tiers, five altitude bands, and a combinable component
library.

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
- A Continent exceeds Bedrock's `64x384x64` structure limit and is therefore
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
