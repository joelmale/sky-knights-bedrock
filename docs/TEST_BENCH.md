# Developer Test Bench

A labelled row of stocked barrels on the home island that lets a tester reach
any ship, module, or combat system directly, without playing the progression
chain first.

This is a development aid. It is never placed automatically, is gated behind
`CommandPermissionLevel.GameDirectors` with `cheatsRequired`, and must not be
present in a build used for fresh-player acceptance testing.

## Usage

```text
/skyknights:test_setup        Prepare the full inspection hub and restock the row
/skyknights:testbench          Place or restock the row
/skyknights:testbench_clear    Remove the row
```

The row appears on the grass north of the home dock, running west to east at
`z = -5`, `y = 161`, spaced two blocks apart. Each barrel has a standing sign
above it naming its contents.

Placement is **idempotent**: running the command again refills only stalls
recorded as bench-owned. Initial placement requires authored grass support and
two empty target cells. Restock and clear also require the saved ownership
marker, expected barrel/sign block types, and the exact labelled sign. Changed
or stale stalls are skipped, so the command does not claim or erase a later
player build occupying the row.

## Why it is command-placed, not part of the island structure

Baking the bench into `starter_island.mcstructure` would change authored
terrain and require a deliberate content-version and existing-world replacement
decision. Replacing the starter structure in a live world could destroy
player-built blocks inside its volume. The development-only bench is therefore
placed on demand, and the shipped structure bytes stay untouched.

The layout is defined as data in `TEST_BENCH` in `scripts/config/constants.ts`.
The pure position maths lives in `scripts/gameplay/testbench-layout.ts` so
`tests/testbench.test.ts` can assert the row stays on the island surface and
clear of the dock without a running engine. Only
`scripts/gameplay/testbench.ts` touches `@minecraft/server`.

## Stall inventory

| Stall             | Contents                                                                       |
| ----------------- | ------------------------------------------------------------------------------ |
| Starter Parts     | Ship Core ×8, Canvas Bundle ×16, Thruster Module ×8                            |
| Skycutter Base    | Reinforced Hull ×4, Aether Engine ×1, Cargo Hold ×4, Navigator ×4              |
| Advanced Modules  | Armored Hull ×4, Frostfire Engine ×1, Expanded Cargo Hold ×4                   |
| Cannon + Ammo     | Aether Cannon ×1, Cannon Control ×1, Aether Charge ×64                         |
| Shield + Repair   | Shield Projector ×1, Repair Kit ×16                                            |
| Progression Items | Aether Crystal ×16, Froststeel Ingot ×64, Raider Core ×8                       |
| Raw Materials     | Iron ×64, Diamond ×32, Coal ×64, Redstone ×64, Oak Log/Planks ×64, Emerald ×64 |
| Survival Kit      | Cooked Beef ×64, Diamond Pickaxe, Diamond Sword, Torch ×64                     |

A host test asserts every custom ship part, module, and progression item is
stocked somewhere in the row, so a system can never become unreachable from the
bench without the test failing.

## Suggested per-system recipes

**Skiff flight.** Take Starter Parts, visit Dockmaster Elian, assemble the
skiff. Or use `/skyknights:skiff` to skip assembly entirely.

**Skycutter assembly and refit.** Take Skycutter Base, assemble at the
Dockmaster, then take Advanced Modules and request a refit while docked. Verify
the removed module is returned in the same transaction.

**Cannon combat.** Take Cannon + Ammo. Install the Aether Cannon in the Utility
slot at the dock, board the Skycutter with the owner aboard, then use the Cannon
Control. `/skyknights:raider` resets and spawns the Ashwing Raider on demand.
Remember the cannon ray only damages `skyknights:sky_raider`.

**Shield and recovery.** Take Shield + Repair. Install the Shield Projector
(mutually exclusive with the cannon) and use Repair Kits to test dock repair and
blueprint reconstruction.

**Progression skips.** Take Progression Items to jump the tutorial chain — an
Aether Crystal advances the Skycutter gate, Froststeel the refit gate, and a
Raider Core the Shield Projector award.

## Limits

The bench proves that systems _function_ when handed their inputs. It
deliberately does not prove that those inputs are _obtainable_ by a fresh
player — that is what the progression-closure host test and the hands-on plans
in `PHASE_2_PLAYTEST.md`, `CRYSTAL_TO_CUTTER_TEST_PLAN.md`, and
`DOCKYARD_REFIT_COMBAT_TEST_PLAN.md` cover.

Never record a bench-assisted run as acceptance evidence for a progression or
onboarding gate.
