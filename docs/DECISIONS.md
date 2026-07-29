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
contract with the walkable-surface prospect. The `0.3.5` correction adds a
five-block exposed stone boulder beside the workshop so the wooden-pick to
stone-pick route is visible rather than merely possible through the buried
core. Starter island content version 6 allows an already schema-5 island
tracked as unmodified to rebuild. Player-modified islands remain protected and
require a fresh world to validate the new authored terrain.
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

The stable template source is created by a guarded external-BDS workflow rather
than by editing a client save. It pins the world seed and Survival/debug
defaults, writes the canonical one-air flat layer, removes only the
runner-owned pre-patch database while the server is stopped, then reopens and
freezes the result. A separate copy is scanned at the origin and in newly
generated distant chunks through Y=-64..319 across a restart before the
current stable packs are embedded. The package uses stable template UUIDs,
short embedded-pack paths, exact world pack references, sorted root archive
entries, and no random-seed opt-in.

This automation establishes a reviewable sky-only source and packaging
contract. It does not replace clean-client import, rendering, reload,
multiplayer, input, or performance acceptance.

## ADR-018 — Versioned island variety and resumable continents

Status: accepted for the `0.3.8` ambient-island variety slice; Minecraft
acceptance remains pending.

The ambient planner advances from `a1` to `a2`. New solo islands select one of
four weighted size tiers and one of five deterministic altitude bands. The
planner also reserves six widely spaced continent sites, but deterministically
activates at most two. A continent is a 150×40×150 composition of 21
30×40×30 parts, roughly four times a Landmark island's footprint dimensions.
It does not count against the separate 224-solo cap.

Existing `a1` terrain is inert: it is not relocated, restamped, or counted
against the `a2` caps. A valid `a1` job that was already in flight may finish
against its original Standard template. This narrowly preserves interrupted
generation without reactivating old planned terrain.

Generation jobs gain optional ordered parts and a monotonic part cursor without
a world-schema bump. Single-part jobs retain their existing representation.
Multipart jobs preflight their complete footprint, place and verify one
contiguous row at a time, checkpoint after every part, and pause five ticks
between placements. On resume, an already valid current part advances the
cursor instead of being mistaken for player obstruction. Checkpointed parts
are not revalidated into overwriting or retrying after a player edits them;
remaining parts still receive a complete preflight plus just-in-time race
checks. The ticking area therefore remains bounded to one row rather than the
whole continent.

Structure composition follows an explicit replacement contract. `-1` means
"do not overwrite the destination" and is used at open seams; declared
`minecraft:air` is an intentional carve and is emitted after solid blocks.
Component integrity probes are rotated with their placement and must remain
inside authored body material. Solo templates, feature templates, component
templates, and dual-use templates are categorized in the machine-readable
variety specification and verified against the emitted structure modules.

Every template also owns a complete local safe-dock coordinate. Automated
checks require solid non-hazardous footing with two clear blocks above it.
Runtime translates this coordinate from the logical footprint, including
continents whose persisted job origin is the first component rather than the
150×150 bounding-box corner.

Two approved planning dimensions were reduced when generator assertions proved
them incompatible with their own budgets. `comp_lake` uses a sealed 6×5,
two-deep basin instead of 8×7×4 to stay under 420 liquid blocks.
`comp_ridge` uses a radius-8, height-16 peak instead of radius 11 to stay under
11,000 solid blocks. The implemented values supersede the earlier planning
notes and are recorded in the machine-readable specification.

Only volcanic Crag and Landmark solo islands evaluate burn variants. Eternal
embers use a deterministic 1-in-8 gate. A bounded reactive oak pyre uses a
1-in-16 gate only after the ember gate misses and only on Landmarks, making the
variants mutually exclusive and rare. Continents never evaluate either burn
gate.

The rescue threshold moves from Y=64 to Y=20 because legal deep-band islands
can begin near Y=60. Basic-ship range remains horizontal-only, so altitude
variation does not consume flight range. These choices, the planner weights,
component layout, and hands-on gates are specified in
[`design/archipelago_variety_spec.json`](design/archipelago_variety_spec.json)
and [`ARCHIPELAGO_HANDS_ON_TEST_PLAN.md`](ARCHIPELAGO_HANDS_ON_TEST_PLAN.md).

## ADR-019 — Mount-scoped camera assist for large prototype craft

Status: accepted for the `0.3.9` summon-only prototype slice; Minecraft
acceptance remains pending.

Bedrock's rideable seat contract can set the third-person camera radius, but it
does not force a player's perspective. The stable Script API therefore selects
the built-in `minecraft:third_person` preset once when a player transitions
onto the Aether Outrigger or Steampunk Blimp. An active Bedrock camera preset
locks its perspective, so third person intentionally remains active for the
mounted interval even though the runtime does not redundantly reapply it.
Dismounting or changing to another mount clears the scripted camera, restores
the player's selected normal perspective and perspective input, and permits a
fresh assist on the next mount. FOV is never changed, and the Skiff,
Skycutter, owned Skycraft, and unrelated mounts are outside this behavior.
Because the stable camera calls can throw, activation and cleanup remain
explicit retry states. Warnings are deduplicated per transition, but a failed
clear is never treated as successful or forgotten.

The Outrigger uses geometry as the primary sightline correction: its main
design is doubled, both seats move to the forward deck, and the mast/sail move
aft with the sail's lower edge above seated eye height. The Outrigger and Blimp
use 12- and 16-block third-person seat radii respectively. Client testing must
still prove transition timing, mounted perspective locking, dismount
restoration, camera collision, motion comfort, normal perspective-input
restoration, and input/device behavior.

## ADR-020 — Fibonacci-annulus `a3` planner and useful-area scaling

Status: accepted for the `0.3.10` ambient-density and scale slice; Minecraft
acceptance remains pending.

“Ten times larger” is defined as approximately ten times usable top area, not
ten times every linear dimension. A literal linear scale would create one
hundred times the footprint and one thousand times the volume, exceed
Bedrock's 64-block horizontal Structure Block limit, violate the project's
top-Y contract, and make the requested density physically impossible.
Progression islands and the existing 150×40×150 continents therefore remain
unchanged. The new scale applies only to ambient solo tiers.

Run 3 uses compact `a3_<base36 index>` identifiers. It distributes 2,563
candidate sites from radius 600 through 3,200 in Fibonacci-sized annular
cohorts of 13, 21, 34, 55, 89, 144, 233, 377, 610, and 987 sites. A seeded
golden-angle phase produces a natural spiral/annulus field rather than rigid
concentric spokes. Radius selection is area-uniform; direction uses fixed-point
CORDIC; neither placement nor selection uses wall-clock time, shared random
streams, or floating-point trigonometry.

The active preferred tier weights are 15% Islet, 55% Standard, 25% Crag, and
5% Landmark. Exact 3D overlap checks may deterministically fall back to a
smaller tier or another legal altitude. Eight family-only Voronoi hubs assign
Verdant, Desert, Tundra, and Volcanic palettes without moving the sites. The
reference 512-block windows contain 2.0–2.6 times the `a2` solo candidates,
while the runtime query radius is 768 so the inner 600-block cohort can begin
preparing from the central realm.

Measured usable top areas are 377, 1,009, 2,828, and 9,176 cells, or
10.77×, 11.09×, 9.15×, and 10.18× their `a2` equivalents. Islets and Standards
remain single placements. A 64×34×64 Crag uses four 32×34×32 quadrants, and a
120×40×120 Landmark uses sixteen reusable 30×40×30 parts. Every unique
placement remains at or below 50,000 bounding cells and 11,000 solid blocks;
multipart jobs retain the existing persisted cursor, row loading, preflight,
five-tick spacing, and integrity behavior.

This is a new plan, not a reinterpretation. `a1` and `a2` identifiers,
structure bytes, terrain, and valid interrupted jobs remain supported. Old
solo history is outside the `a3` cap. The six `a2` continent sites remain
authoritative and retain their separate two-continent cap; the runtime reserves
their complete footprints against `a3` candidates.

The permanent solo cap remains 224. “Two to three times more” means nearby
candidate density in this slice, not two to three times the saved history.
Worst-case migrated state exceeds the tested 30 KB document budget before a
448-island cap, so any cap increase requires an explicit compact/sharded
persistence migration plus fresh-world, restart, multiplayer, and weakest
device evidence.

## ADR-021 — Cluster-center `a4` planner replaces annular solo belts

Status: accepted for the unreleased archipelago recovery slice; Minecraft
acceptance remains pending.

Run 3's `a3` planner is frozen. Its Fibonacci-sized annuli increased candidate
density but placed individual islands directly on narrow bands, so neighboring
cohorts could read as continuous belts rather than separate archipelagos.
Changing the `a3` formula would reinterpret already shipped IDs and could move
generated or player-modified terrain.

Run 4 therefore uses new `a4_<base36 site>` IDs and makes cluster centers, not
individual islands, the radial unit. Ten Fibonacci cohorts contain exactly 374
centers. They are area-uniformly distributed across four vertical decks, with
a deterministic minimum 560-block same-deck center gap. Each non-reserved
center owns one family, one anchor, four possible satellites, and a
260-block maximum reach. Seeded vigor and fixed presence gates yield roughly
three to four members per populated cluster; exact 3D checks retain deterministic
tier fallback and prevent overlap.

The six continent centers reserve their full 600-block formula footprint plus
cluster reach and the 12-block edge gap. Generated `a3` terrain is also an
obstruction for new `a4` selection. Runtime can still rederive and finish a
valid interrupted `a3` job, but only `a4` is selected for new solo terrain.
`a3` and `a4` use separate compact bitsets at the serialization boundary, so
neither namespace can reinterpret the other.

## ADR-022 — Formula continents stream under a fixed, crash-safe `c1` contract

Status: accepted at a 600-block span for the unreleased recovery slice;
Minecraft appearance, pacing, migration, multiplayer, and weakest-device
acceptance remain pending.

The 150×40×150 multipart continent library is frozen for `a2` recovery. New
continents use the deterministic integer field in
`scripts/generation/continent-field.ts` and exact one-chunk volume plans in
`continent-chunk-plan.ts`. The six centers remain the frozen run-2 centers, but
formula terrain uses new canonical `c1_<siteIndex>` IDs. A generated legacy
`a2` continent suppresses `c1` at that site, valid interrupted `a2` jobs remain
recoverable, and legacy plus formula continents share the existing lifetime
cap of two.

BDS `1.26.34.3` measured a hard 32,768-block `fillBlocks` ceiling: 32,768
filled and an explicit 32,769-block volume threw. It also showed that
`ignoreChunkBoundErrors` still throws across an unloaded span. Runtime
therefore loads and verifies exactly one chunk, rejects any chunk plan or
individual volume above the measured ceiling, and never requests partial
loaded-chunk behavior. It limits execution to four calls per tick, matching
the measured batch comparison rather than issuing a whole relief plan in one
tick.

Every write filters for `minecraft:air`; entities defer the task for 200 ticks,
and a previously occupied new volume is recorded as skipped. The scheduler may
choose another incomplete chunk during that entity cooldown. A ticking-area,
load, or fill failure instead backs off all formula work for 200 ticks so the
solo scheduler can advance before formula retry. Progress lives in the
new permanent `skyknights:continent_progress_v1` property rather than world
schema 5. Each possible 600-block site has a fixed 181-byte chunk bitset, but
only started sites are stored. An exact `{continentId, chunkIndex}` checkpoint
is saved before the first fill. After a crash, only that chunk may bypass the
new-volume obstruction check, and it still fills air only. Corrupt schema,
seed, field version, ID, bitset length, base64, or unused bits fails closed.

This slice implements terrain, strata, coastline, and lakes for one Verdant
material family. Authored decorations, docks, resources, encounters, larger
1,200–1,800 spans, and formula caves remain later gates rather than implied
content.
