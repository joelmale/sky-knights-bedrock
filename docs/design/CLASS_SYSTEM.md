# Class System — design specification

> Status: **proposed. Not implementation evidence.** No code for this exists.
>
> Targets `@minecraft/server` 2.8.0 and `@minecraft/server-ui` 2.1.0, verified
> against the shipped typings in `node_modules/@minecraft/`.

## 1. The central tension, resolved

Progression here is ship-centric: five certification rungs in
`scripts/skycraft/progression.ts` gated by eleven milestones, plus a twelve-step
tutorial objective chain. A character class is a second axis, and two XP bars
competing for one play session is the failure mode.

**Resolution: there is no class XP. Character level is a pure function of
progression the game already tracks.**

- **Certifications stay the world gate** — what you can build and where you can
  fly. Untouched by this design.
- **Class is the expression layer** — what you do when you get there. Chosen,
  not earned.
- **Level is derived, not accumulated.** `level = 1 + achieved deeds` over an
  explicit 19-entry ladder, where every deed is an existing milestone,
  objective, or progression-island discovery. Time spent on ship progression
  *is* class progression, by construction. No second bar, because no second
  currency.

What the player chooses is a class and how to spend 19 talent points — a
decision surface, not a treadmill.

**Class does not modify ship handling, deliberately.** Handling comes from the
mass/lift/thrust solver in `scripts/skycraft/engineering.ts`, which is
deterministic and host-tested against blueprints. A per-pilot multiplier would
make one blueprint fly differently for different pilots, break those tests, and
create a "you need an Aeronaut to fly the good ship" multiplayer trap. Aeronaut
affects the pilot, not the craft.

Class modifies personal combat, personal survivability, personal off-ship
mobility, and exploration quality-of-life. It never modifies crafting,
blueprint access, or any ship permission.

**Why not fold classes into certifications?** Certifications are material-gated
one-shot unlocks. A class needs a repeatable, respec-able choice. Folding them
would either make the choice permanent at the moment an item is found, or make
certifications respec-able and let a player un-earn a ship cap. Different
lifecycles: keep them separate, make one derive from the other.

## 2. Roster — three classes

| Class         | Fantasy                                | Owns                                    | Existing crew role     |
| ------------- | -------------------------------------- | --------------------------------------- | ---------------------- |
| **Skyguard**  | the knight who holds the deck          | melee, mitigation, ally protection      | `mechanic`, `builder`  |
| **Gunwright** | the artillerist-marksman               | ranged, cannons, charges                | `gunner`               |
| **Aeronaut**  | the pilot-scout who survives the void  | mobility, fall survival, discovery      | `pilot`, `navigator`   |

Three, not five: each class needs four ability icons, twelve talent nodes of
copy, and localization. Three is 12 items and 36 nodes; five is 20 and 60, on
top of a ship system with 20+ open in-game gates. Three is also the minimum that
differentiates a multiplayer trio, and it maps onto the three things Bedrock
genuinely expresses — intercepted damage, spawned projectiles, and vanilla
movement effects. A fourth would be a reskin.

**No Engineer class.** The Skycraft blueprint system already is the crafting
fantasy. A class gating blueprint access would soft-lock solo players.

## 3. Progression curve

**Levels 1-20.** Level 1 on oath-taking, 20 at content complete.

Level is `1 + achieved deeds` over an ordered 19-deed ladder authored as a
table, sourced from the eleven existing milestones, the tutorial objective
chain, and discovery of the eight progression islands.

**Ambient `a3` islands are excluded.** With 2,563 candidate sites, including
them would make level farmable by touching islets.

Per level: +1 talent point (19 total). Ability slots open at levels 1, 5, 10, 15.

**Twelve talent nodes per class, ranks 1-3, 24 total ranks.** 19 points cannot
buy 24, forcing specialisation — consistent with the existing hardpoint rule.

**Respec is free, always, at the Dockmaster.** Bedrock forms cannot communicate
build consequences well enough to justify punishing a bad choice, and free
respec makes the system testable in one session. **Class change is allowed**,
level preserved because it is derived.

## 4. Stat model — four stats, each with named artefacts

### Vigour — effective HP

`minecraft:health_boost` effect, refreshed on interval, particles hidden.

**A player's max health cannot be raised directly.** `EntityAttributeComponent`
exposes only `setCurrentValue`; `effectiveMax` is `readonly`
(`index.d.ts:9745`). Health Boost is the only path.

Artefacts: an effect icon appears in the inventory list; a milk bucket clears it
and there is no effect-removed event, so it must be re-applied on interval;
granularity is 4 HP per amplifier, so no +1 HP talents; a lapse clamps current
health and reads as sudden damage, so refresh at twice the period.

### Might — outgoing damage

`world.beforeEvents.entityHurt`, mutating `event.damage`.

**`damage` is writable** (`index.d.ts:10817`, not `readonly`, unlike
`damageSource` two fields below). There is no hurt-then-compensate, so no double
red flash, no double knockback, no double death message.

Artefacts that remain: the callback runs in restricted-execution mode, so every
side effect — sound, particle, actionbar — must be deferred with `system.run`
and lands a tick later. There is still **no custom damage type**, so armour,
Protection and Resistance all apply after the multiplier; armour-ignoring damage
is not expressible. Bedrock has no damage numbers, so the multiplier is
invisible. The signal fires for every hurt entity in the world, so the handler
must early-out and be scoped with `EntityHurtBeforeEventOptions`.

### Ward — incoming reduction

The same mechanism mirrored, **capped at 30%** so vanilla armour stays the
primary defence.

Artefact: reduction is invisible; a player cannot tell 20% from 30%. Show the
number in the class form.

### Agility — movement

Vanilla effects only. `EntityMovementComponent` exists, but for a player walk
speed is client-simulated; the reliable server-side lever is the effect set.
**Do not ship a "+7% speed" talent — it is not expressible.** Speed I is a
coarse +20% step, and speed does nothing while mounted, so Agility must be
described as an off-ship stat.

### Not modelled

Attack speed (no API). Crit chance (nothing renders it, and it makes host tests
non-deterministic). **Mana** — there is no custom HUD and the actionbar is
already contended. This is the largest single Portal Knights feature Bedrock
cannot do; cooldowns plus a consumable replace it.

## 5. Abilities

**An ability is a custom item with a registered custom component** — the only
trigger surface that is discoverable, identical across keyboard, controller and
touch, and gets a real cooldown swipe. One parameterised registration serves all
twelve, following the existing `skyknights:fire_cannon` pattern.

**Cooldown in two layers**: item JSON declares `minecraft:cooldown` with a
per-class category so the hotbar shows the swipe; the authoritative gate stays a
script-side map, because the overlay is presentation and a category is shared.

**Secondary trigger, at most one per class**: `playerButtonInput` with Sneak.
Caveat from the typings — on touch, Sneak is pressed for at most one tick and
released immediately even while held. **A hold-to-guard ability is not
portable**; build it as a toggle or not at all.

A spell can: spawn and re-own a vanilla projectile, spawn particles and sounds,
ray-cast or query nearby entities and apply damage, add effects, apply impulses,
manipulate the camera, and briefly restrict input permissions.

A spell cannot: lock on to a target, channel with a cast bar, bypass armour,
summon a persistent intelligent minion, or animate the player's own body.

**Four slots maximum**, all instant or short-duration, each with particle, sound
and actionbar — those three are the entire feedback vocabulary. Slot cost is
real: four abilities are four hotbar slots not holding a sword. Mitigate with
the level ramp and an **Ability Focus** item that opens a picker, costing one
slot and one extra tap. Recommended as the default on touch.

## 6. UI

`@minecraft/server-ui` 2.1.0 ships more than the three classic form types:
**`CustomForm`** with `ObservableBoolean` / `ObservableNumber` /
`ObservableString`, per-button `onClick`, `disabled` and `visible` observables,
dividers, headers and labels, plus `MessageBox` and `UIManager`. There are
**zero `@beta` markers in that file** — this is all stable.

That materially changes the skill-tree story. A talent tree becomes **one
persistent form**: clicking a node fires `onClick`, points-remaining updates
through an observable without a reopen, unaffordable nodes grey out.

**Where it still breaks down**: it is a list, not a graph. No arrows, no
columns, no 2-D layout. A "tree" is a flat ordered list with a header per branch
and a text rank prefix; prerequisites are communicated by disabling, not by
lines. **`CustomForm` is untested in this repository** — every existing form
uses `ActionFormData`/`ModalFormData`. Treat it as an in-game acceptance gate on
all three input methods, and build the nested-`ActionFormData` fallback behind
the same interface so the choice is one flag.

**Persistent readouts**: `setActionBar` is already written by four modules. **Do
not add a fifth writer.** Class publishes level-up via title cards and readiness
via the cooldown swipe. An actionbar arbiter refactor is a prerequisite.

**Do not hijack the vanilla XP bar** — it would break enchanting and anvils.

## 7. Persistence — 34 bytes

Player schema 3 to 4, one optional field: class id, base64-packed talent
allocation, talent schema version.

Twelve nodes at two bits each is 24 bits — **four base64 characters, fixed**,
regardless of spend. The whole field serialises at **34 bytes** against a current
`PlayerState` of roughly 250-400 and a 30,000-byte working budget.

**Not stored, deliberately:**

- **Level** — recomputed on every load. Level can never desync from progress, a
  deed added later retroactively grants the level, and there is no level
  migration to ever write.
- **Cooldowns** — in-memory, cleared on reload. Losing one is player-favourable
  and costs nothing.
- **Ability unlocks** — a function of level and allocation.

## 8. Multiplayer

Class is per-player, on the player's own dynamic properties.

**There is no taunt, threat, or aggro API.** Mob targeting is data-driven and no
script API sets a mob's target. The closest workable thing is a Skyguard
damage-share: reduce nearby allies' damage in the hurt handler and apply the
remainder to the Skyguard. Honest artefact — the ally still plays the full hurt
animation and knockback for damage they did not take. If real taunting is
required, **the platform does not support it** and it should be dropped rather
than faked.

**Class must never gate a ship permission.** A Gunwright must not be required to
fire a cannon, or a two-player world where both picked Aeronaut cannot fight.
Class improves a seat, never unlocks it. Assert with a host test.

**Open decision for the owner**: milestones are world-scoped today, so deriving
level from them means a player joining an advanced world inherits most of its
level. Recommend accepting this as the anti-grind, join-your-friend behaviour,
deriving from world milestones plus per-player objective and discovery. Strictly
per-player levels would require migrating milestones to a per-player host.

## 9. Host-testable versus in-game

**Host-testable, zero Minecraft**: the deed ladder and its monotonic bounded
level function; the talent table, prerequisites and rank caps, including that 19
points cannot buy 24 ranks; stat resolution and its caps; allocation codec
round-trip, with garbage decoding to empty rather than throwing; ability cost,
cooldown and slot gating; schema v3-to-v4 migration; that every ability item
exists in the registry and in localization; and that class never appears in any
permission decision.

**Needs Minecraft**: `CustomForm` rendering and live observable updates across
keyboard, controller and touch; whether the health-boost refresh is invisible;
whether damage scaling produces intended numbers against real armour and
enchantments, and its per-tick cost; whether Sneak behaves as documented on
touch; whether the cooldown overlay appears for a script-set category; whether
one-tick-deferred feedback is perceptible; whether damage-share reads as a tank
rather than a bug; and reload behaviour.

## 10. Build order

0. **Owner decision gate** — confirm level is derived, and the world-scoped
   milestone inheritance behaviour. Everything depends on these.
1. Pure rules and tests, no Minecraft.
2. Player schema v3 to v4 and migration tests. No behaviour yet.
3. **Actionbar arbiter refactor**, before class writes anything, or the first
   class feature will flicker. This is the one place class forces a change to
   shipped code.
4. The vertical slice below.
5. `CustomForm` talent screen plus fallback; Dockmaster entry.
6. Remaining two classes.
7. Multiplayer damage-share and the two-player gate.
8. Testbench stall and a dev override command.
9. Balance, content matrix rows, changelog, test plan, ADR.

## 11. Vertical slice — Skyguard, levels 1-5, one ability, one stat

Dockmaster gains "Take a Knightly Oath": three buttons, only Skyguard enabled,
the others visibly disabled so the shape of the system is legible from day one.

Level derives from the first five deeds, which the existing tutorial chain
already produces on the way to the first skiff — **a fresh-world tester reaches
level 5 by playing the current opening.**

One stat live: **Ward**, 4% per level to 20%, proving the riskiest mechanic. One
ability: **Bulwark**, an item with a cooldown category, eight seconds of elevated
ward with particle, sound and actionbar — proving item component, cooldown and
feedback. One talent node with three ranks, proving spend, persistence
round-trip and respec.

Acceptance: fresh void-template world, one player, keyboard and touch; then two
players, to prove class is per-player and nothing became world-scoped by
accident.

**Why this slice**: it touches every risky edge exactly once and needs no new
entity, model or texture beyond one item icon. If damage interception or the
cooldown overlay disappoints in-game, that costs days rather than months.

## 12. Risks and unsupported things

1. `CustomForm` is untested here; if it renders badly the talent screen degrades
   to nested forms and spending 19 points becomes tedious.
2. The hurt handler runs in restricted-execution mode; all feedback defers a
   tick, and perceptibility is unknown until tested in game.
3. **No taunt, threat or aggro API.** The tank fantasy is approximated, not
   delivered.
4. **No mana, cast bars, damage numbers, custom HUD, 2-D tree, or player
   animation.** Portal Knights' most legible RPG surfaces are client UI Bedrock
   does not expose. If the substitutes are judged insufficient, the honest answer
   is to lean harder on abilities-as-items and lighter on stats-as-numbers.
5. **Max health is not settable.** If visible effect icons are unacceptable,
   Vigour must be cut.
6. Player movement speed is not settable; Agility is effect-only and coarse.
7. Actionbar contention across four shipped modules requires a refactor first.
8. **Per-tick cost.** The hurt handler fires for every hurt entity world-wide,
   and the device-performance gates are still open. Measure on the weakest target
   device.
9. Milestones are world-scoped, so level is partly world-scoped.
10. **Scope honesty.** The full build is 12 ability items with icons and
    localization, 36 talent nodes of copy, and a balance pass, on top of an
    unfinished ship system with 20+ open in-game gates. Ship the vertical slice
    and re-decide.
