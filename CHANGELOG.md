# Changelog

This file records shipped playtest builds and notable repository milestones.
Validation evidence and pending hands-on gates are maintained in
[`docs/VALIDATION_LOG.md`](docs/VALIDATION_LOG.md).

## [Unreleased]

### Pending validation

- Complete the `0.2.0` hands-on Dockyard Refit and Airship Combat plan.
- Complete controller, touch, multiplayer, clean-client import, and
  world-template import gates.
- Record balance observations for module costs, cannon combat, and Raider AI.

## [0.2.0] — 2026-07-26

### Added

- Dockmaster refit forms for owner-only, dock-only Skycutter module swaps.
- A data-driven module registry covering the four ship slots.
- Armored Hull with 180 maximum hull and damage reduction.
- Frostfire Engine with extended range and improved flight speed.
- Expanded Cargo Hold with 27 inventory slots and safe downgrade protection.
- Aether Cannon, reusable Cannon Control, and craftable Aether Charges.
- Server-authoritative aimed cannon fire, cooldowns, ammunition consumption,
  hit feedback, and persistent combat counters.
- Persistent Ashwing Raider airship encounter with ranged attacks, recovery,
  shared world state, and a developer reset command.
- Raider Core delivery and Shield Projector reward.
- Conditional Skycutter geometry for armor, cargo, cannon, and shield modules.
- Ashwing Raider entity geometry and resources.
- Five advanced-module/ammunition recipes and eight new custom items.
- Four in-engine GameTests, including expanded cargo and Raider hull checks.
- Focused
  [`Dockyard Refit and Airship Combat Test Plan`](docs/DOCKYARD_REFIT_COMBAT_TEST_PLAN.md).

### Changed

- Stable Behavior and Resource Packs advanced to version `0.2.0`.
- World, player, and ship documents advanced to schemas `4`, `3`, and `3`.
- Legacy completed players migrate into the combat-refit progression.
- Ember Outpost advanced to content version `4`, with 24 guaranteed iron and
  8 guaranteed redstone.
- Frostspire advanced to content version `2`, with 16 guaranteed Froststeel.
- Skycutter configuration is reapplied when its entity loads.
- Diagnostics now report Raider state, installed modules, and combat counters.
- Startup validation now covers every refit/combat entity and item.

### Fixed

- Refit transactions preserve both the replacement and removed module if a
  swap cannot finish.
- Expanded cargo cannot be removed while slots 19–27 contain items.
- Lost Cannon Controls can be reissued by selecting the installed cannon at
  the Dockmaster.
- A missing active Raider can recover without creating a normal second
  encounter.

### Automated evidence

- `npm run verify` passed.
- 25 host-side tests passed across 8 test files.
- Stable, production, experimental, and GameTest builds completed.
- `npm audit --audit-level=high` reported zero vulnerabilities.
- The stable packs were deployed successfully to the local Bedrock
  development-pack folders.

## [0.1.0] — 2026-07-26

Git baseline: `3a2a27e` (`feat: add crystal-to-cutter playtest slice`).

### Added

- Solid Verdant starter island, Ember Outpost, and Frostspire authored
  structures with resumable, content-versioned placement.
- Self-healing Dockmaster Elian and guided tutorial objectives.
- Craftable two-seat starter skiff with native three-dimensional flight.
- Aether Crystal expedition and four-slot, four-seat Skycutter assembly.
- Persistent owned-ship references, pilot arbitration, 18-slot cargo,
  extended-range travel, hull damage, repair, recall, destruction, and
  reconstruction.
- Guaranteed progression loot and the Crystal-to-Cutter objective chain.
- Development commands for debugging, ship spawning, island rebuilding, and
  recovery.
- Stable world-template packaging, experimental custom-dimension profile, and
  opt-in GameTest profile.
- Focused Phase 0, Phase 2, and Crystal-to-Cutter test plans.

### Fixed during hands-on validation

- Registered custom commands so `/skyknights:debug` loads correctly.
- Made starter-island regeneration deterministic and substantially solid.
- Corrected skiff launch height and collision/mounting behavior.
- Preserved the starter island and Dockmaster across reloads.
- Restored a missing Dockmaster at the starter dock.
- Corrected the Skycutter named-slot module type error in `skiff.ts`.

### Validation

- The user confirmed starter-island restoration, skiff mounting and movement,
  island regeneration, and the Crystal-to-Cutter playtest path.
- Host-side checks and production packaging passed before the baseline commit.

## [0.0.1] — 2026-07-25

Git baseline: `07ecfe2` (`chore: scaffold Bedrock development environment`).

### Added

- Behavior Pack, Resource Pack, TypeScript, tests, CI, and VS Code scaffold.
- Fixed pack UUIDs, stable Script API pins, local deployment, debugger, and
  packaging commands.
- Architecture roadmap, development-environment notes, and initial decisions.

### Changed

- Replaced the deprecated Mojang task-runner dependency chain with
  repository-owned build tooling using TypeScript, esbuild, Prettier, and
  fflate.
- Added explicit install-script approval for the pinned esbuild version.

### Security

- Removed inherited deprecated `inflight`, `glob@7`, `rimraf@3`, and
  `@types/chokidar` dependencies.
- Reduced the reported ten high-severity npm findings to zero.
