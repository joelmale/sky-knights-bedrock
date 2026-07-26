# Architecture Decisions

## ADR-001 — Bedrock Add-On

Status: accepted.

Sky Knights will be implemented as a Behavior Pack, Resource Pack, and
TypeScript Script API project. Native-code mod loaders are outside scope.

## ADR-002 — Stable API baseline

Status: accepted.

The initial repository targets Minecraft 1.26.30+ with `@minecraft/server`
2.8.0 and `@minecraft/server-ui` 2.1.0. Beta APIs require a separate profile and
decision.

## ADR-003 — Entity-based airships

Status: accepted for the entity-based ship architecture.

Airships will be rideable flying entities with dockyard-configured frames and
modules. Version 1.0 will not promise that arbitrary player-built blocks can
move as a rigid body.

The gray-box `skyknights:skiff` implements the two-seat, native air-controlled
model. Hands-on mounting and flight validation confirmed that the entity model
is usable. Controller, touch, and multiplayer rows in
`docs/PHASE_0_VALIDATION.md` remain release validation rather than architecture
blockers.

The next frame, `skyknights:skycutter`, keeps the same native entity-flight
model while adding four fixed module slots, four seats, an 18-slot cargo
inventory, owner-only piloting, health, dock repair, recall, and blueprint
reconstruction. Player-built blocks remain separate Minecraft structures; they
do not become moving ship geometry.

## ADR-004 — Dimension strategy

Status: accepted for the stable vertical slice.

The stable release will use a packaged void world/template. Custom dimensions
remain an isolated experimental profile because their Script API still requires
Beta APIs as of Bedrock 1.26.33. The experimental profile remains available to
rerun registration, reload, copy, upgrade, travel, and multiplayer gates.

Revisit this decision only if the experimental matrix passes and installation
into an existing world becomes a product requirement.

## ADR-005 — Vanilla-first content

Status: accepted.

Vanilla mining, placement, inventory, recipes, water, lava, and ordinary combat
remain authoritative where they satisfy the design. Custom systems are reserved
for Sky Knights identity and progression.

## ADR-006 — Authored-first hybrid island generation

Status: accepted for the vertical slice.

The first islands are authored `.mcstructure` templates placed through a
resumable scripted queue. Procedural generation may later choose, decorate, or
combine authored templates, but the vertical slice will not generate every
block algorithmically.

## ADR-007 — Versioned dynamic-property documents

Status: accepted.

World, player, and ship persistence is accessed only through typed
repositories. Each document carries a schema version. The world repository
implements migrations through schema 3. Schema 3 adds per-island content
versions so corrected or upgraded structures can be rebuilt without
regenerating every island; runtime gameplay modules do not use raw
dynamic-property identifiers.

Player and ship documents advance to schema 2 for tutorial progression, owned
ship references, owner name recovery, frame selection, named module slots, and
docked state. Version 1 player and skiff documents migrate on read.

## ADR-008 — Owned cargo ships and recovery

Status: accepted for the Crystal-to-Cutter slice.

Each player owns at most one progression ship. The owner must occupy the pilot
seat before passengers board, and the Skycutter's native cargo inventory is
restricted to its tamed owner. Ship location and module configuration persist.
Recall moves the same entity back to the home dock; it does not create a copy.
A destroyed Skycutter can be reconstructed from its saved blueprint for one
Repair Kit, but destroyed cargo is intentionally not duplicated.
