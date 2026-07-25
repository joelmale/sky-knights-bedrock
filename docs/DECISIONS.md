# Architecture Decisions

## ADR-001 — Bedrock Add-On

Status: accepted.

Sky Knights will be implemented as a Behavior Pack, Resource Pack, and TypeScript Script API project. Native-code mod loaders are outside scope.

## ADR-002 — Stable API baseline

Status: accepted.

The initial repository targets Minecraft 1.26.30+ with `@minecraft/server` 2.8.0 and `@minecraft/server-ui` 2.1.0. Beta APIs require a separate profile and decision.

## ADR-003 — Entity-based airships

Status: proposed pending Phase 0 flight proof.

Airships will be rideable flying entities with dockyard-configured frames and modules. Version 1.0 will not promise that arbitrary player-built blocks can move as a rigid body.

## ADR-004 — Dimension strategy

Status: open.

Phase 0 will compare:

- a stable packaged void world/world template;
- an experimental custom `skyknights:sky_realm` dimension.

The stable world-template route is the fallback.

## ADR-005 — Vanilla-first content

Status: accepted.

Vanilla mining, placement, inventory, recipes, water, lava, and ordinary combat remain authoritative where they satisfy the design. Custom systems are reserved for Sky Knights identity and progression.
