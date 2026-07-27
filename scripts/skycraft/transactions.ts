import { AirshipTransactionState } from "./types";

export type Authority = "docked_blueprint" | "flight_entity" | "none";
export type TransactionAction =
  | "lock_berth"
  | "scan_validate"
  | "persist_blueprint"
  | "clear_dock"
  | "spawn_flight"
  | "configure_flight"
  | "persist_in_flight"
  | "reserve_dock"
  | "persist_docking"
  | "dismount_crew"
  | "restore_dock"
  | "verify_dock"
  | "remove_flight"
  | "persist_docked"
  | "unlock_berth";

export interface TransactionPlan {
  next: AirshipTransactionState;
  authority: Authority;
  actions: readonly TransactionAction[];
  safe: boolean;
}

const PLANS: Readonly<Record<AirshipTransactionState, TransactionPlan>> = {
  docked: {
    next: "validating",
    authority: "docked_blueprint",
    actions: ["lock_berth", "scan_validate"],
    safe: true,
  },
  validating: {
    next: "launching",
    authority: "docked_blueprint",
    actions: ["persist_blueprint"],
    safe: true,
  },
  launching: {
    next: "in_flight",
    authority: "flight_entity",
    actions: [
      "clear_dock",
      "spawn_flight",
      "configure_flight",
      "persist_in_flight",
    ],
    safe: true,
  },
  in_flight: {
    next: "docking",
    authority: "flight_entity",
    actions: ["reserve_dock", "persist_docking", "dismount_crew"],
    safe: true,
  },
  docking: {
    next: "docked",
    authority: "docked_blueprint",
    actions: [
      "restore_dock",
      "verify_dock",
      "remove_flight",
      "persist_docked",
      "unlock_berth",
    ],
    safe: true,
  },
  recovery_required: {
    next: "recovery_required",
    authority: "none",
    actions: [],
    safe: false,
  },
};

export function planAdvance(state: AirshipTransactionState): TransactionPlan {
  return PLANS[state];
}

export function planFailure(state: AirshipTransactionState): TransactionPlan {
  if (state === "docked" || state === "validating") {
    return {
      next: "docked",
      authority: "docked_blueprint",
      actions: ["unlock_berth"],
      safe: true,
    };
  }
  if (state === "in_flight") {
    return {
      next: "in_flight",
      authority: "flight_entity",
      actions: [],
      safe: true,
    };
  }
  return {
    next: "recovery_required",
    authority: "none",
    actions: [],
    safe: false,
  };
}

export function planRecovery(
  state: AirshipTransactionState,
  dockPresent: boolean,
  flightPresent: boolean,
): TransactionPlan {
  if (dockPresent && !flightPresent) {
    return {
      next: "docked",
      authority: "docked_blueprint",
      actions: ["verify_dock", "persist_docked", "unlock_berth"],
      safe: true,
    };
  }
  if (!dockPresent && flightPresent) {
    return {
      next: "in_flight",
      authority: "flight_entity",
      actions: ["configure_flight", "persist_in_flight"],
      safe: true,
    };
  }
  return {
    next: "recovery_required",
    authority: "none",
    actions: [],
    safe: false,
  };
}
