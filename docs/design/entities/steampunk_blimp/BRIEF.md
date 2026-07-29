# Steampunk Blimp Prototype Brief

Status: implementation in progress

## Outcome

Create a completely separate, summon-only airship entity inspired by a large
canvas-envelope steampunk dirigible. The prototype must read clearly as a
different class from the Aether Outrigger, Skiff, and Skycutter.

Identifiers are frozen for this slice:

| Contract             | Value                                        |
| -------------------- | -------------------------------------------- |
| Behavior entity      | `skyknights:steampunk_blimp`                 |
| Geometry             | `geometry.skyknights.steampunk_blimp`        |
| Texture              | `textures/entity/skyknights/steampunk_blimp` |
| Developer command    | `/skyknights:blimp`                          |
| Forward direction    | local `-Z`                                   |
| Stern and propellers | local `+Z`                                   |
| Texture resolution   | 256×256 RGBA                                 |
| Visible bounds       | width 12, height 10, offset `[0, 5, 0]`      |

## Visual contract

The silhouette consists of:

- a large elongated cream-canvas balloon with dark wood and copper ribs;
- a narrowed nose, tapered stern, and distinct vertical and horizontal fins;
- suspension struts or rigging between the envelope and gondola;
- a substantial wooden gondola with an open deck, cabin, windows, and bow;
- twin side engine housings with cyan Aether accents; and
- separately named port and starboard propeller bones suitable for continuous
  animation.

The canonical texture is an external PNG. The Blockbench source owns geometry,
bones, pivots, and UV placement; it must not be the only copy of the texture.

## Gameplay contract

This is a test vehicle, not a progression reward or owned custom Skycraft.

- It is summonable but does not spawn naturally.
- It uses stable Bedrock entity components and proven air-controlled movement.
- It is slower and tougher than the starter craft.
- It has a controlling helm seat and multiple passenger seats.
- It is persistent, nameable, immune to fall damage, and not bump-pushable.
- Propellers animate on the client without requiring experimental APIs.
- No persistence schema, technology certification, blueprint registry, crafting
  recipe, or combat activation is added in this slice.

## Bone contract

The final geometry must retain these integration-facing names:

- `root`
- `balloon`
- `tail_fins`
- `gondola`
- `engine_left`
- `engine_right`
- `propeller_left`
- `propeller_right`

Additional detail bones are allowed. Renaming an integration-facing bone
requires central-architect approval because animation files depend on it.

## Multi-role ownership

| Role                        | Exclusive files                                                                |
| --------------------------- | ------------------------------------------------------------------------------ |
| Blockbench technical artist | Blimp `.bbmodel`, geometry export, model exporter                              |
| Texture/material specialist | Blimp PNG and entity-specific texture generator                                |
| Bedrock entity integrator   | Blimp BP/RP definitions, animations, focused test                              |
| Central architect           | Shared constants, validation, commands, localization, documentation, packaging |
| Independent QA              | Read-only integrated review and Minecraft acceptance findings                  |

## Verification gates

Automated gates:

1. every identifier and asset reference resolves;
2. geometry parses and contains the frozen bones;
3. both propeller pivots have animation channels;
4. the texture is exactly 256×256;
5. flight, seats, collision, persistence, and push behavior match this brief;
6. focused tests, repository verification, and the production package pass.

Minecraft acceptance remains separate. It must cover rendering from all sides,
seat placement, camera obstruction, mounting and dismounting, propeller
animation, steering, collision, multiplayer seats, save/reload, and removal.
