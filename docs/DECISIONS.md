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

Status: accepted for the shipping Skiff/Skycutter architecture; superseded for
future ship-builder scope by ADR-015.

The shipping Skiff and Skycutter are rideable flying entities with
dockyard-configured frames and modules. They remain supported prototypes and
legacy craft; player-built skycraft does not silently replace their identifiers
or saved state.

The gray-box `skyknights:skiff` implements the two-seat, native air-controlled
model. Hands-on mounting and flight validation confirmed that the entity model
is usable. Controller, touch, and multiplayer rows in
`docs/PHASE_0_VALIDATION.md` remain release validation rather than architecture
blockers.

The next frame, `skyknights:skycutter`, keeps the same native entity-flight
model while adding four fixed module slots, four seats, an 18-slot cargo
inventory, owner-only piloting, health, dock repair, recall, and blueprint
reconstruction. In the current build, player-built blocks remain separate
Minecraft structures and do not become moving ship geometry.

## ADR-004 — Dimension strategy

Status: accepted for the stable vertical slice.

The stable release will use a packaged void world/template. Custom dimensions
remain an isolated capability profile. `@minecraft/server` 2.8.0 exposes
`DimensionRegistry` in the stable API and creates a separate void-generator
dimension, but it does not replace `minecraft:overworld`. Sky Knights has not
yet accepted the cross-dimension spawn, recovery, migration, feature-pass,
upgrade, and multiplayer contracts required to move the main game there.

The opt-in profile remains available to rerun registration, reload, copy,
upgrade, travel, and multiplayer gates without making those unproven contracts
part of the stable gameplay pack.

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

## ADR-012 — Self-healing released-island bootstrap

Status: accepted for the `0.3.0` playtest build.

The three released islands are a required sequential bootstrap, not developer
setup. Startup persists and resumes one job at a time in the order starter
island, Ember Outpost, Frostspire. A job waits for its ticking area to be fully
loaded and for integrity probes to succeed before it is checkpointed and marked
generated. Transient runtime failures retain the persisted job and retry with
backoff; an initial player remains eligible for automatic safe-dock arrival
until the starter is complete.

`/skyknights:island` is a safe resume aid, not a force-restamp command. Normal
startup must not overwrite player-modified authored terrain. The default fresh
world seed is deterministic so equivalent default bootstrap worlds do not
depend on runtime randomness.

## ADR-013 — Starter resource-budget and integrity contract

Status: accepted for the `0.3.1` corrective slice.

The fresh-world starter path ships raw vanilla resources, not direct Skiff
components, so players exercise the intended tools, mining, smelting, recipes,
and Dockmaster assembly loop. The authored starter island must visibly provide
two oak trees (8 logs), 12 iron ore, 8 coal ore, abundant stone, a crafting
table, and a furnace. At least one iron and one coal block must be adjacent and
visible from the walkable workshop surface, with additional ore directly below
them. This is deliberately buffered above the first skiff's 7 ingots, 2 recipe
coal, 1 fuel coal, cobblestone, and wood/tool needs.

A host-side contract verifies the structure's resource budget against the
shipping recipes and Dockmaster requirements. Runtime integrity probes are part
of the same authored-structure contract: they must match the placed dock and
workshop blocks, because a false probe can leave a visibly placed island queued
and correctly defer safe arrival.

The `0.3.3` corrective patch replaces the misleading cliff-only visibility
contract with the walkable-surface prospect. Starter island content version 5
allows an already schema-5 island tracked as unmodified to rebuild.
Player-modified islands remain protected and require a fresh world to validate
the new authored terrain.
Because schema 4 and earlier did not record terrain edits, every island already
generated before a schema-5 migration is conservatively marked protected when
its layout record is created.

## ADR-014 — Layered BDS/GameTest validation

Status: accepted for the `0.3.1` validation-infrastructure slice.

Sky Knights uses three non-substitutable validation layers: host tests for pure
and packaged contracts, opt-in BDS/GameTest automation for server-authoritative
integration, and real-client hands-on acceptance for UI, controls, rendering,
network behavior, and play feel. A passing lower layer never closes a higher
layer's gate.

BDS remains a manually downloaded, external, test-only dependency. The harness
owns only fixed sentinel-guarded paths, temporarily configures authenticated
non-discoverable test ports, restores the original server properties, retains
version/pack/log/result evidence, and rejects unverified BDS versions. The
GameTest npm package version supplies build-time types; the manifest declares
the shorter runtime version actually exposed by the supported BDS build.

`SimulatedPlayer` may extend bounded interaction tests, but its event behavior
and lack of real client forms/input/rendering make it unsuitable as a
replacement for the Minecraft hands-on plan. A BDS/GameTest Validation Engineer
owns the harness slice, while an independent BDS Safety/Release Reviewer
challenges its destructive paths, process lifecycle, network exposure, and
evidence claims.

## ADR-015 — Bounded player-built skycraft

Status: accepted and implemented as an integrated `0.3.2` prototype; promotion
is still gated by the `0.4.0` BDS and hands-on feasibility evidence.

Players will build a connected, bounded wooden airframe inside a registered
dock berth around exactly one Helm and Ship Core. A deterministic scan creates
a canonical, versioned blueprint and validates block count, dimensions, mass,
lift, directional engine output, control, seats, cargo reserve, hardpoints, and
technology certification. Validation persists before any launch-side world
mutation.

The exact docked block construction is authoritative. Flight uses a separate
persistent rideable entity representation generated from the blueprint.
Docking restores the editable construction through an atomic transaction.
Launch, docking, reload recovery, and destruction must maintain exactly one
authoritative state and never duplicate blocks, components, or cargo.

The first spike compares a bounded voxel-style proxy with an authored modular
proxy. No documentation may promise arbitrary block-perfect moving collision,
free walking on a moving deck, unbounded block counts, or exact in-flight
visual reproduction until the relevant renderer, target-device, and
multiplayer gates pass.

Progression raises both a visible block cap and a mass/lift certification.
Starter technology combines simple lift and thrust; later craft separate
passive Airbag/Aether lift from directional propulsion. Downward engines
contribute lift, aft engines contribute forward thrust, and other orientations
provide braking or lateral control. The technology tree branches between
large, efficient, slower dirigibles and compact, expensive, agile Aether craft.

Dockmaster reference blueprints and player-saved blueprints use the exact same
materials, certifications, validator, ownership, damage, and recovery contracts
as custom designs. Purchasing a reference plan or construction order is an
in-game convenience and cannot bypass progression or duplicate cargo/unique
items.

Existing Skiff and Skycutter entities, identifiers, and saves coexist with the
new repository. Any retrofit is explicit, owner-approved, migration-tested, and
reversible through normal recovery. The full mechanic, technology tree,
delivery phases, provisional caps, and evidence gates are defined in
[`SKYCRAFT_TECHNOLOGY_ROADMAP.md`](SKYCRAFT_TECHNOLOGY_ROADMAP.md).

## ADR-016 — Authored Skycraft proxy and gated later tiers

Status: accepted for the `0.3.2` integrated prototype.

The first runtime selects the roadmap's authored modular flight-proxy fallback.
The exact docked blueprint remains authoritative and reconstructs byte-stable
approved block states. Flight classifies the design into a bounded authored
raft, cutter, dirigible, disc, combat, expedition, or masterwork visual. The
proxy is allowed to preserve engineering identity without reproducing every
voxel, but real-client testing must still prove that the result is readable and
recognizable.

Implementation does not promote unmeasured caps. Apprentice construction is
available for ordinary hands-on testing. Advanced certification code, assets,
recipes, and reference fixtures are packaged but require the explicit
`skyknights.skycraft_experimental` tester tag. The tag bypasses progression
only in cheats-enabled test worlds and is never release evidence.

Skycraft persistence uses a separate bounded fleet index, per-airship chunked
records, owner-scoped personal-blueprint records, and a world milestone
document. Corrupt or unknown schemas, stale revisions, oversized records,
unauthorized actors, and ambiguous dock/flight authority fail closed. Legacy
Skiff/Skycutter state is not migrated implicitly.

Physical cargo is not approximated. Cargo racks contribute an abstract
reserved mass and slot count to engineering, but launch and docking reject any
runtime cargo authority other than `disabled`. A later physical-container
implementation requires an atomic ownership transfer and restart/destruction
no-duplication matrix before activation.

## ADR-017 — Void-template, structure-template archipelago

Status: accepted for the `0.3.4` procedural archipelago slice.

The intended sky-only world uses a packaged void source world. Ambient island
bodies remain deterministic `.mcstructure` templates, while a seeded Script
API planner selects bounded cells, altitude, and one of four clustered visual
families. Runtime generation is observer-driven, queues only one persisted job
at a time, verifies loaded chunks and integrity probes, and refuses to stamp an
ambient island over an occupied volume.

Ambient planner IDs carry their planner version (`a1`) and are always
rederived with that version. An authored-island layout migration cannot
silently move an existing ambient job. The first release exposes more than 900
possible cells but persists at most 384 ambient outcomes to stay below the
world-document budget.

Bedrock feature rules remain a complementary experiment, not the authoritative
island transaction. The correct native chain is `.mcstructure` →
`minecraft:structure_template_feature` → `minecraft:feature_rules` → a biome
selected through `minecraft:biome_filter`; custom tags belong in the biome's
`minecraft:tags` component. Feature rules may later add disposable vegetation,
clouds, and minor ruins after an in-engine void-dimension proof. Progression
islands and protected-space guarantees remain under the persisted planner.

The detailed contract and experimental proof gate are in
[`PROCEDURAL_ARCHIPELAGO.md`](PROCEDURAL_ARCHIPELAGO.md).
