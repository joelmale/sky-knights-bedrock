import {
  blockMassSubunits,
  SKYCRAFT_COMPONENTS,
  SkycraftComponentId,
} from "./config";
import {
  AirshipBlueprint,
  Certification,
  Direction,
  EngineeringReport,
} from "./types";

function opposite(direction: Direction): Direction {
  return direction === "north"
    ? "south"
    : direction === "south"
      ? "north"
      : direction === "east"
        ? "west"
        : direction === "west"
          ? "east"
          : direction === "up"
            ? "down"
            : "up";
}

function ceilPercent(value: number): number {
  return Math.floor((value * 115 + 99) / 100);
}

/** Later engines on the same craft lose 15% effective output per prior engine. */
function scaledEngineOutput(value: number, engineIndex: number): number {
  return Math.floor((value * 100) / (100 + engineIndex * 15));
}

export function evaluateAirship(
  blueprint: AirshipBlueprint,
  certification: Certification,
  loadedCargoMassSubunits = 0,
): EngineeringReport {
  const diagnostics: string[] = [];
  const dryMassSubunits = blueprint.blocks.reduce(
    (total, block) => total + blockMassSubunits(block.typeId),
    0,
  );
  const seatCount =
    1 +
    blueprint.components.filter((component) => component.kind === "seat")
      .length;
  const crewMassSubunits = seatCount * 4;
  let cargoMassSubunits = Math.max(0, Math.trunc(loadedCargoMassSubunits));
  let liftSubunits = 0;
  let forwardThrust = 0;
  let brakingThrust = 0;
  let lateralControl = 0;
  let hullPoints = blueprint.blocks.length * 2;
  let cargoSlots = 0;
  let hardpointCount = 0;
  let engineIndex = 0;
  const forward = blueprint.berth.orientation;
  const aft = opposite(forward);

  if (forward === "up" || forward === "down") {
    diagnostics.push("Helm orientation must be horizontal.");
  }

  for (const component of blueprint.components) {
    const spec = SKYCRAFT_COMPONENTS[component.typeId as SkycraftComponentId];

    if (spec === undefined) {
      continue;
    }

    liftSubunits += spec.passiveLiftSubunits ?? 0;
    if (component.kind !== "engine") {
      lateralControl += spec.control ?? 0;
    }
    hullPoints += spec.hull ?? 0;
    cargoMassSubunits += spec.cargoReserveSubunits ?? 0;
    cargoSlots += spec.cargoSlots ?? 0;

    if (component.kind === "lift") {
      liftSubunits += spec.liftSubunits ?? 0;
    }

    if (component.kind === "hardpoint") {
      hardpointCount += 1;
    }

    if (component.kind !== "engine") {
      continue;
    }

    if (component.facing === undefined) {
      diagnostics.push(
        `Engine at ${component.x},${component.y},${component.z} needs a direction.`,
      );
      engineIndex += 1;
      continue;
    }

    if (component.facing === "down") {
      liftSubunits += scaledEngineOutput(spec.liftSubunits ?? 0, engineIndex);
    } else if (component.facing === aft) {
      forwardThrust += scaledEngineOutput(spec.thrust ?? 0, engineIndex);
    } else if (component.facing === forward) {
      brakingThrust += scaledEngineOutput(spec.braking ?? 0, engineIndex);
    } else if (
      component.facing === "east" ||
      component.facing === "west" ||
      component.facing === "north" ||
      component.facing === "south"
    ) {
      lateralControl += scaledEngineOutput(spec.control ?? 0, engineIndex);
    } else {
      diagnostics.push(
        `Engine at ${component.x},${component.y},${component.z} has an unsupported direction.`,
      );
    }

    engineIndex += 1;
  }

  const massSubunits = dryMassSubunits + crewMassSubunits + cargoMassSubunits;
  const requiredLiftSubunits = ceilPercent(massSubunits);
  const liftReserveSubunits = liftSubunits - requiredLiftSubunits;
  const engines = blueprint.components.filter(
    (component) => component.kind === "engine",
  ).length;

  if (blueprint.blocks.length > certification.blockCap) {
    diagnostics.push(
      `Block count ${blueprint.blocks.length} exceeds ${certification.blockCap}.`,
    );
  }
  if (massSubunits > certification.massCapSubunits) {
    diagnostics.push(
      `Departure mass ${massSubunits} exceeds ${certification.massCapSubunits}.`,
    );
  }
  if (engines > certification.engineCap) {
    diagnostics.push(
      `Engine count ${engines} exceeds ${certification.engineCap}.`,
    );
  }
  if (seatCount > certification.seatCap) {
    diagnostics.push(
      `Seat count ${seatCount} exceeds ${certification.seatCap}.`,
    );
  }
  if (hardpointCount > certification.hardpointCap) {
    diagnostics.push(
      `Hardpoint count ${hardpointCount} exceeds ${certification.hardpointCap}.`,
    );
  }
  if (certification.id === "apprentice_raft" && cargoSlots > 0) {
    diagnostics.push("Cargo is unavailable for Apprentice Rafts.");
  }
  if (liftReserveSubunits < 0) {
    diagnostics.push(
      `Insufficient lift: add ${-liftReserveSubunits} lift subunits.`,
    );
  }
  if (forwardThrust === 0) {
    diagnostics.push("No aft-facing engine provides forward thrust.");
  }
  if ((engines > 1 || blueprint.blocks.length > 56) && lateralControl === 0) {
    diagnostics.push("This craft requires a rudder or stabilizer.");
  }

  const handling =
    liftReserveSubunits < 0
      ? "refused"
      : liftReserveSubunits * 100 <= requiredLiftSubunits * 15
        ? "heavy"
        : liftReserveSubunits * 100 <= requiredLiftSubunits * 40
          ? "normal"
          : "agile";

  return {
    allowed: diagnostics.length === 0,
    dryMassSubunits,
    crewMassSubunits,
    cargoMassSubunits,
    massSubunits,
    requiredLiftSubunits,
    liftSubunits,
    liftReserveSubunits,
    forwardThrust,
    brakingThrust,
    lateralControl,
    hullPoints,
    seatCount,
    cargoSlots,
    hardpointCount,
    handling,
    diagnostics,
  };
}
