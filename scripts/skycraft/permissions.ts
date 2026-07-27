import { AirshipState, CrewRole } from "./types";

export type SkycraftAction =
  | "edit"
  | "launch"
  | "dock"
  | "recover"
  | "pilot"
  | "navigate"
  | "gun"
  | "repair"
  | "passenger";
const ACTION_ROLES: Readonly<Record<SkycraftAction, readonly CrewRole[]>> = {
  edit: ["owner", "builder"],
  launch: ["owner"],
  dock: ["owner", "pilot"],
  recover: ["owner"],
  pilot: ["owner", "pilot"],
  navigate: ["owner", "navigator"],
  gun: ["owner", "gunner"],
  repair: ["owner", "mechanic"],
  passenger: [
    "owner",
    "passenger",
    "builder",
    "pilot",
    "navigator",
    "gunner",
    "mechanic",
  ],
};
export function rolesForPlayer(
  state: Pick<AirshipState, "ownerPlayerId" | "crew">,
  playerId: string,
): readonly CrewRole[] {
  if (state.ownerPlayerId === playerId) return ["owner"];
  return state.crew.find((member) => member.playerId === playerId)?.roles ?? [];
}
export function canPerform(
  state: Pick<AirshipState, "ownerPlayerId" | "crew">,
  playerId: string,
  action: SkycraftAction,
): boolean {
  const roles = rolesForPlayer(state, playerId);
  return ACTION_ROLES[action].some((role) => roles.includes(role));
}
export function choosePilot(
  state: Pick<AirshipState, "ownerPlayerId" | "crew">,
  pilotId: string,
  currentPilotId?: string,
): { allowed: boolean; pilotId?: string } {
  if (!canPerform(state, pilotId, "pilot"))
    return { allowed: false, pilotId: currentPilotId };
  return currentPilotId === undefined || currentPilotId === pilotId
    ? { allowed: true, pilotId }
    : { allowed: false, pilotId: currentPilotId };
}

export function canOccupyNextSeat(
  state: Pick<AirshipState, "ownerPlayerId" | "crew">,
  playerId: string,
  occupiedSeats: number,
  certifiedSeats: number,
): boolean {
  if (occupiedSeats >= certifiedSeats) {
    return false;
  }

  return canPerform(
    state,
    playerId,
    occupiedSeats === 0 ? "pilot" : "passenger",
  );
}
