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
implements migrations through schema 5. Schema 3 adds per-island content
versions, schema 4 adds the shared Ashwing Raider encounter, and schema 5 adds
the derived world seed, profile, layout version, persisted island placements,
reserved bounds, and sticky player-modified protection. Runtime gameplay
modules do not use raw dynamic-property identifiers.

Persisted layout records always win over a later planner result. Placing or
breaking a block inside an island's authored structure volume marks that island
as player-modified, preventing automatic content-version regeneration from
stamping over the edit.

Player and ship documents advance to schema 3. Player schema 3 extends the
tutorial through combat. Ship schema 3 adds persistent shots, hits, and Raider
defeats. Earlier player and ship documents migrate on read.

## ADR-008 — Owned cargo ships and recovery

Status: accepted for the Crystal-to-Cutter slice.

Each player owns at most one progression ship. The owner must occupy the pilot
seat before passengers board, and the Skycutter's native cargo inventory is
restricted to its tamed owner. Ship location and module configuration persist.
Recall moves the same entity back to the home dock; it does not create a copy.
A destroyed Skycutter can be reconstructed from its saved blueprint for one
Repair Kit, but destroyed cargo is intentionally not duplicated.

## ADR-009 — Dockyard refit and aimed airship combat

Status: accepted for the `0.2.0` slice.

Skycutter configuration remains four mutually exclusive module slots. Module
swaps are available only to the owner while the ship is at the starter dock,
and the Dockmaster returns the removed module as part of one atomic inventory
transaction. Expanded cargo cannot be removed while its extra slots are
occupied.

The Aether Cannon uses a reusable control item, consumes crafted charges, and
performs a server-authoritative 64-block aim ray. A visible projectile is an
effect rather than the damage authority. A shared, persistent Ashwing Raider
encounter activates after a cannon-equipped launch. Returning its core awards
the mutually exclusive Shield Projector, preserving an offense-versus-defense
Utility-slot choice.

## ADR-010 — Deterministic realm registry and staged activation

Status: accepted for the Phase 3 foundation.

One typed island registry owns stable IDs, structures, families, tiers,
geometry, anchors, integrity probes, placement mode, and gameplay activation.
The three released islands retain their exact pinned origins. Five additional
authored structures use deterministic, purpose-separated seeded placement on
integer tier rings with reserved bounds and clear travel lanes.

Terrain packaging and gameplay activation are separate states. A
`structure_only` island may be generated by the authoring tool, packaged,
validated, and assigned a persistent layout, but player-facing discovery cannot
queue it. Activation changes to `ready` only after every referenced item,
entity, localization entry, encounter, guaranteed reward, and progression
source exists and validates.

Structure verification is non-mutating. `npm run verify` compares checked-in
`.mcstructure` artifacts with deterministic generator output and fails when an
artifact is missing or stale.

## ADR-011 — Hub-and-spoke multi-agent development

Status: accepted as the default for substantial future slices.

One high-capability central architect owns scope, architecture, cross-system
integration, verification, documentation, and commits. Lower-cost specialists
receive bounded, non-overlapping file ownership and targeted checks. An
independent QA/release role challenges the integrated result before the central
architect declares completion.

Use isolated worktrees when the agent platform supports them. In a shared
worktree, editing roles must have disjoint ownership and repository-wide
formatting, generation, staging, and commits remain central responsibilities.
The vendor-neutral operating contract is
[`MULTI_AGENT_WORKFLOW.md`](MULTI_AGENT_WORKFLOW.md), with discoverable
instructions in [`../AGENTS.md`](../AGENTS.md).
