import { SKYCRAFT_IDS, SKYCRAFT_LIMITS } from "../config";
import { AirshipState, BlockPosition } from "../types";
import { AirshipRepository } from "./repository";

export interface RuntimeWorld {
  getBlock(position: BlockPosition):
    | {
        typeId: string;
        states: Readonly<Record<string, string | number | boolean>>;
      }
    | undefined;
  setBlock(
    position: BlockPosition,
    block?: {
      typeId: string;
      states: Readonly<Record<string, string | number | boolean>>;
    },
  ): void;
  spawnFlight(
    typeId: typeof SKYCRAFT_IDS.flightEntity,
    position: BlockPosition,
  ): string;
  configureFlight(entityId: string, state: AirshipState): void;
  removeFlight(entityId: string): void;
  flightExists(entityId: string): boolean;
}

export interface ExecutorResult {
  ok: boolean;
  state: AirshipState;
  reason?: string;
}

function worldPosition(
  origin: BlockPosition,
  relative: BlockPosition,
): BlockPosition {
  return {
    x: origin.x + relative.x,
    y: origin.y + relative.y,
    z: origin.z + relative.z,
  };
}

function sameBlock(
  left:
    | {
        typeId: string;
        states: Readonly<Record<string, string | number | boolean>>;
      }
    | undefined,
  right: {
    typeId: string;
    states: Readonly<Record<string, string | number | boolean>>;
  },
): boolean {
  if (left?.typeId !== right.typeId) {
    return false;
  }
  const leftKeys = Object.keys(left.states).sort();
  const rightKeys = Object.keys(right.states).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && left.states[key] === right.states[key],
    )
  );
}

function failed(
  repository: AirshipRepository,
  state: AirshipState,
  reason: string,
): ExecutorResult {
  const next: AirshipState = {
    ...state,
    recoveryFrom:
      state.transaction === "recovery_required"
        ? state.recoveryFrom
        : state.transaction,
    transaction: "recovery_required",
  };
  repository.save(next);
  return { ok: false, state: next, reason };
}

export class SkycraftExecutor {
  public constructor(
    private readonly repository: AirshipRepository,
    private readonly world: RuntimeWorld,
  ) {}

  public launch(
    state: AirshipState,
    helmWorldPosition: BlockPosition,
  ): ExecutorResult {
    if (state.cargo.authority !== "disabled") {
      return {
        ok: false,
        state,
        reason: "Cargo activation requires the cargo transaction gate.",
      };
    }
    if (
      state.damage.hullDamage > 0 ||
      state.damage.damagedComponents.length > 0
    ) {
      return {
        ok: false,
        state,
        reason: "Repair all recorded hull and subsystem damage before launch.",
      };
    }
    if (state.transaction !== "docked") {
      return { ok: false, state, reason: "Airship is not docked." };
    }
    try {
      let activeCraft = 0;
      for (const id of this.repository.ids()) {
        const candidate = this.repository.load(id);
        if (candidate === undefined) {
          return {
            ok: false,
            state,
            reason: `Skycraft record ${id} is corrupt; launch fails closed.`,
          };
        }
        if (
          candidate.transaction === "in_flight" ||
          candidate.flightEntityId !== undefined
        ) {
          activeCraft += 1;
        }
      }
      if (activeCraft >= SKYCRAFT_LIMITS.activeCraftCap) {
        return {
          ok: false,
          state,
          reason: `The active Skycraft safety cap (${SKYCRAFT_LIMITS.activeCraftCap}) is already reached.`,
        };
      }
    } catch (error) {
      return {
        ok: false,
        state,
        reason:
          error instanceof Error
            ? error.message
            : "The Skycraft fleet index is unavailable.",
      };
    }

    const validating: AirshipState = {
      ...state,
      transaction: "validating",
      dockedHelmPosition: {
        ...helmWorldPosition,
        dimensionId: state.blueprint.berth.dimensionId,
      },
    };
    this.repository.save(validating);

    for (const block of validating.blueprint.blocks) {
      if (
        !sameBlock(
          this.world.getBlock(worldPosition(helmWorldPosition, block)),
          block,
        )
      ) {
        const docked: AirshipState = {
          ...validating,
          transaction: "docked",
        };
        this.repository.save(docked);
        return {
          ok: false,
          state: docked,
          reason: "Docked blueprint no longer matches the world.",
        };
      }
    }

    let launching: AirshipState = {
      ...validating,
      transaction: "launching",
    };
    this.repository.save(launching);

    try {
      for (const block of launching.blueprint.blocks) {
        this.world.setBlock(worldPosition(helmWorldPosition, block));
      }

      const entityId = this.world.spawnFlight(
        SKYCRAFT_IDS.flightEntity,
        helmWorldPosition,
      );
      launching = { ...launching, flightEntityId: entityId };
      // Persist the spawned entity reference before any configuration can fail.
      this.repository.save(launching);
      this.world.configureFlight(entityId, launching);
      const inFlight: AirshipState = {
        ...launching,
        transaction: "in_flight",
        recoveryFrom: undefined,
        lastSafeLocation: {
          ...helmWorldPosition,
          dimensionId: launching.blueprint.berth.dimensionId,
        },
      };
      this.repository.save(inFlight);
      return { ok: true, state: inFlight };
    } catch (error) {
      return failed(
        this.repository,
        launching,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  public dock(
    state: AirshipState,
    helmWorldPosition: BlockPosition,
  ): ExecutorResult {
    if (state.cargo.authority !== "disabled") {
      return {
        ok: false,
        state,
        reason: "Cargo activation requires the cargo transaction gate.",
      };
    }
    if (
      state.transaction !== "in_flight" ||
      state.flightEntityId === undefined ||
      !this.world.flightExists(state.flightEntityId)
    ) {
      return failed(this.repository, state, "Flight entity is unavailable.");
    }

    for (const block of state.blueprint.blocks) {
      if (
        this.world.getBlock(worldPosition(helmWorldPosition, block)) !==
        undefined
      ) {
        return { ok: false, state, reason: "Dock berth is obstructed." };
      }
    }

    const docking: AirshipState = {
      ...state,
      transaction: "docking",
      dockedHelmPosition: {
        ...helmWorldPosition,
        dimensionId: state.blueprint.berth.dimensionId,
      },
    };
    this.repository.save(docking);

    try {
      for (const block of docking.blueprint.blocks) {
        this.world.setBlock(worldPosition(helmWorldPosition, block), {
          typeId: block.typeId,
          states: block.states,
        });
      }

      for (const block of docking.blueprint.blocks) {
        if (
          !sameBlock(
            this.world.getBlock(worldPosition(helmWorldPosition, block)),
            block,
          )
        ) {
          throw new Error("Dock reconstruction verification failed.");
        }
      }

      this.world.removeFlight(docking.flightEntityId as string);
      const docked: AirshipState = {
        ...docking,
        transaction: "docked",
        recoveryFrom: undefined,
        flightEntityId: undefined,
        activePilotId: undefined,
      };
      this.repository.save(docked);
      return { ok: true, state: docked };
    } catch (error) {
      return failed(
        this.repository,
        docking,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  public recover(state: AirshipState): ExecutorResult {
    const helm = state.dockedHelmPosition;
    const flightPresent =
      state.flightEntityId !== undefined &&
      this.world.flightExists(state.flightEntityId);

    if (helm === undefined) {
      return failed(
        this.repository,
        state,
        "No recorded dock Helm position is available.",
      );
    }

    const dockBlocks = state.blueprint.blocks.map((block) =>
      this.world.getBlock(worldPosition(helm, block)),
    );
    const dockExact = dockBlocks.every((block, index) =>
      sameBlock(block, state.blueprint.blocks[index]),
    );
    const dockEmpty = dockBlocks.every((block) => block === undefined);
    const dockCompatible = dockBlocks.every(
      (block, index) =>
        block === undefined || sameBlock(block, state.blueprint.blocks[index]),
    );

    if (dockExact && !flightPresent) {
      const docked: AirshipState = {
        ...state,
        transaction: "docked",
        recoveryFrom: undefined,
        flightEntityId: undefined,
      };
      this.repository.save(docked);
      return { ok: true, state: docked };
    }

    if (dockEmpty && flightPresent) {
      try {
        this.world.configureFlight(state.flightEntityId as string, state);
        const inFlight: AirshipState = {
          ...state,
          transaction: "in_flight",
          recoveryFrom: undefined,
        };
        this.repository.save(inFlight);
        return { ok: true, state: inFlight };
      } catch (error) {
        return failed(
          this.repository,
          state,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    if (
      dockCompatible &&
      !flightPresent &&
      (state.recoveryFrom === "launching" ||
        state.recoveryFrom === "validating")
    ) {
      try {
        for (let index = 0; index < state.blueprint.blocks.length; index += 1) {
          if (dockBlocks[index] === undefined) {
            const block = state.blueprint.blocks[index];
            this.world.setBlock(worldPosition(helm, block), {
              typeId: block.typeId,
              states: block.states,
            });
          }
        }
        const docked: AirshipState = {
          ...state,
          transaction: "docked",
          recoveryFrom: undefined,
          flightEntityId: undefined,
        };
        this.repository.save(docked);
        return { ok: true, state: docked };
      } catch (error) {
        return failed(
          this.repository,
          state,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    if (
      dockCompatible &&
      !flightPresent &&
      state.recoveryFrom === "in_flight"
    ) {
      try {
        for (let index = 0; index < state.blueprint.blocks.length; index += 1) {
          if (dockBlocks[index] === undefined) {
            const block = state.blueprint.blocks[index];
            this.world.setBlock(worldPosition(helm, block), {
              typeId: block.typeId,
              states: block.states,
            });
          }
        }
        const docked: AirshipState = {
          ...state,
          transaction: "docked",
          recoveryFrom: undefined,
          flightEntityId: undefined,
          activePilotId: undefined,
        };
        this.repository.save(docked);
        return { ok: true, state: docked };
      } catch (error) {
        return failed(
          this.repository,
          state,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    if (dockCompatible && flightPresent && state.recoveryFrom === "docking") {
      try {
        for (let index = 0; index < state.blueprint.blocks.length; index += 1) {
          if (dockBlocks[index] === undefined) {
            const block = state.blueprint.blocks[index];
            this.world.setBlock(worldPosition(helm, block), {
              typeId: block.typeId,
              states: block.states,
            });
          }
        }
        this.world.removeFlight(state.flightEntityId as string);
        const docked: AirshipState = {
          ...state,
          transaction: "docked",
          recoveryFrom: undefined,
          flightEntityId: undefined,
        };
        this.repository.save(docked);
        return { ok: true, state: docked };
      } catch (error) {
        return failed(
          this.repository,
          state,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    if (dockExact && flightPresent && state.flightEntityId !== undefined) {
      // The persisted transaction tells us which side had authority. A failed
      // launch keeps the flight copy; a failed dock keeps the reconstructed
      // dock copy and removes the flight proxy.
      if (state.recoveryFrom === "docking") {
        try {
          this.world.removeFlight(state.flightEntityId);
          const docked: AirshipState = {
            ...state,
            transaction: "docked",
            recoveryFrom: undefined,
            flightEntityId: undefined,
          };
          this.repository.save(docked);
          return { ok: true, state: docked };
        } catch (error) {
          return failed(
            this.repository,
            state,
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      return failed(
        this.repository,
        state,
        "Both dock and flight copies exist; owner resolution is required.",
      );
    }

    return failed(
      this.repository,
      state,
      "Partial or obstructed dock state requires owner intervention.",
    );
  }
}
