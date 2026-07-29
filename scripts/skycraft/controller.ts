import {
  BlockPermutation,
  Container,
  EntityComponentTypes,
  EntityInventoryComponent,
  EntityRideableComponent,
  ItemStack,
  Player,
  system,
  world,
} from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

import { STARTER_ISLAND } from "../config/constants";
import { Logger } from "../diagnostics/logger";
import {
  MaterialConsumption,
  planMaterialConsumption,
} from "../gameplay/dockyard-materials";
import { PlayerStateRepository } from "../persistence/repositories";
import {
  SKYCRAFT_BERTHS,
  SkycraftBerthDefinition,
  berthContains,
  skycraftBerth,
} from "./berths";
import {
  REFERENCE_BLUEPRINTS,
  ReferenceBlueprint,
  referenceLayout,
  referenceMaterials,
} from "./catalog";
import {
  SKYCRAFT_CERTIFICATIONS,
  SKYCRAFT_HELM_IDS,
  SKYCRAFT_IDS,
  componentAvailableAtCertification,
} from "./config";
import { evaluateAirship } from "./engineering";
import { SkycraftMilestoneRepository } from "./milestones";
import { canOccupyNextSeat, canPerform } from "./permissions";
import {
  SKYCRAFT_EXPERIMENTAL_CERTIFICATION_TAG,
  SkycraftMilestone,
  activatedCertifications,
  canUseReferenceBlueprint,
} from "./progression";
import { scanAirship } from "./scanner";
import {
  AirshipBlueprint,
  AirshipState,
  BlueprintComponent,
  CertificationId,
  CrewRole,
} from "./types";
import {
  BedrockDimensionReader,
  BedrockRuntimeWorld,
  WorldDynamicPropertyHost,
} from "./runtime/bedrock";
import { createRuntimeBlockReader } from "./runtime/block-reader";
import { BlueprintLibrary } from "./runtime/blueprint-library";
import { SkycraftExecutor } from "./runtime/executor";
import { AirshipRepository } from "./runtime/repository";

const BERTH_MARKER_PREFIX = "skyknights:berth_ready_v1:";
const PLATFORM_BLOCK = "minecraft:smooth_stone";
const CREW_ROLES: readonly CrewRole[] = [
  "builder",
  "pilot",
  "navigator",
  "gunner",
  "mechanic",
  "passenger",
];
const LABOR_FEES: Readonly<Record<CertificationId, number>> = {
  apprentice_raft: 2,
  ember_skiff: 8,
  specialist_airframe: 16,
  expedition_skycraft: 32,
  masterwork_skycraft: 48,
};

const dynamicHost = new WorldDynamicPropertyHost();
const airships = new AirshipRepository(dynamicHost);
const personalBlueprints = new BlueprintLibrary(dynamicHost);
const milestones = new SkycraftMilestoneRepository(dynamicHost);

interface CertifiedBuild {
  state: AirshipState;
  report: ReturnType<typeof evaluateAirship>;
  scanDiagnostics: readonly string[];
}

export function registerSkycraftRuntime(logger: Logger): void {
  world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    if (event.target.typeId !== SKYCRAFT_IDS.flightEntity) {
      return;
    }

    let allowed = false;
    try {
      const airshipId = event.target.getDynamicProperty(
        "skyknights:airship_id",
      );
      const state =
        typeof airshipId === "string" ? airships.load(airshipId) : undefined;
      const rideable = event.target.getComponent(
        EntityComponentTypes.Rideable,
      ) as EntityRideableComponent | undefined;
      const occupiedSeats = rideable?.getRiders().length ?? 0;
      const certifiedSeats =
        state === undefined
          ? 0
          : 1 +
            state.blueprint.components.filter(
              (component) => component.kind === "seat",
            ).length;
      allowed =
        state !== undefined &&
        state.transaction === "in_flight" &&
        rideable !== undefined &&
        canOccupyNextSeat(
          state,
          event.player.id,
          occupiedSeats,
          certifiedSeats,
        );
    } catch {
      allowed = false;
    }

    if (!allowed) {
      event.cancel = true;
      system.run(() => {
        if (event.player.isValid) {
          event.player.sendMessage(
            "§cYou are not authorized for the next available Skycraft seat.§r",
          );
        }
      });
    }
  });

  world.beforeEvents.entityHurt.subscribe((event) => {
    if (event.hurtEntity.typeId !== SKYCRAFT_IDS.flightEntity) {
      return;
    }
    const airshipId = event.hurtEntity.getDynamicProperty(
      "skyknights:airship_id",
    );
    const state =
      typeof airshipId === "string" ? airships.load(airshipId) : undefined;
    if (
      state?.blueprint.components.some(
        (component) =>
          component.typeId === SKYCRAFT_IDS.shieldHardpoint &&
          !state.damage.damagedComponents.includes(componentKey(component)),
      )
    ) {
      event.damage *= 0.7;
    }
  });

  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage }) => {
    if (hurtEntity.typeId !== SKYCRAFT_IDS.flightEntity) {
      return;
    }
    const airshipId = hurtEntity.getDynamicProperty("skyknights:airship_id");
    if (typeof airshipId === "string") {
      system.run(() =>
        recordSkycraftDamage(
          airshipId,
          hurtEntity.id,
          damage,
          logger.child("damage"),
        ),
      );
    }
  });

  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (deadEntity.typeId !== SKYCRAFT_IDS.flightEntity) {
      return;
    }
    const airshipId = deadEntity.getDynamicProperty("skyknights:airship_id");
    if (typeof airshipId === "string") {
      system.run(() =>
        recordDestroyedSkycraft(airshipId, logger.child("damage")),
      );
    }
  });

  world.afterEvents.playerInteractWithBlock.subscribe(({ block, player }) => {
    if (!SKYCRAFT_HELM_IDS.has(block.typeId)) {
      return;
    }

    system.run(() => {
      void showHelm(player, block.location, logger.child("helm")).catch(
        (error: unknown) => {
          logger.error("Skycraft Helm interaction failed.", {
            playerId: player.id,
            error: error instanceof Error ? error.message : String(error),
          });
          player.sendMessage(
            "§cThe Helm could not complete that request. Check the Content Log.§r",
          );
        },
      );
    });
  });

  world.afterEvents.playerInteractWithEntity.subscribe(({ player, target }) => {
    if (target.typeId !== SKYCRAFT_IDS.flightEntity || !player.isSneaking) {
      return;
    }

    system.run(() => {
      void showFlightControls(player, target.id, logger.child("flight")).catch(
        (error: unknown) => {
          logger.error("Skycraft flight control failed.", {
            playerId: player.id,
            entityId: target.id,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      );
    });
  });
}

function componentKey(component: BlueprintComponent): string {
  return `${component.typeId}@${component.x},${component.y},${component.z}`;
}

function recordSkycraftDamage(
  airshipId: string,
  entityId: string,
  damage: number,
  logger: Logger,
): void {
  const state = airships.load(airshipId);
  if (state === undefined || state.transaction !== "in_flight") {
    return;
  }

  const report = evaluateAirship(
    state.blueprint,
    SKYCRAFT_CERTIFICATIONS[state.certificationId ?? "apprentice_raft"],
  );
  const hullDamage = Math.min(
    report.hullPoints,
    state.damage.hullDamage + Math.max(0, Math.ceil(damage)),
  );
  const subsystemCandidates = state.blueprint.components
    .filter(
      (component) => component.kind !== "core" && component.kind !== "seat",
    )
    .map(componentKey)
    .sort();
  const damagedCount =
    report.hullPoints <= 0
      ? subsystemCandidates.length
      : Math.min(
          subsystemCandidates.length,
          Math.floor((hullDamage * 4) / report.hullPoints),
        );
  const damagedComponents = [
    ...new Set([
      ...state.damage.damagedComponents,
      ...subsystemCandidates.slice(0, damagedCount),
    ]),
  ].sort();
  airships.save({
    ...state,
    damage: { hullDamage, damagedComponents },
  });

  const entity = world.getEntity(entityId);
  const rideable = entity?.getComponent(EntityComponentTypes.Rideable) as
    EntityRideableComponent | undefined;
  for (const rider of rideable?.getRiders() ?? []) {
    if (rider.typeId === "minecraft:player") {
      (rider as Player).onScreenDisplay.setActionBar(
        `§c${state.displayName ?? "Skycraft"} damage: ${hullDamage}/${report.hullPoints}; disabled systems: ${damagedComponents.length}.§r`,
      );
    }
  }
  logger.info("Player-built Skycraft damage persisted.", {
    airshipId,
    hullDamage,
    hullMaximum: report.hullPoints,
    damagedComponents,
  });
}

function recordDestroyedSkycraft(airshipId: string, logger: Logger): void {
  const state = airships.load(airshipId);
  if (state === undefined || state.transaction !== "in_flight") {
    return;
  }
  const report = evaluateAirship(
    state.blueprint,
    SKYCRAFT_CERTIFICATIONS[state.certificationId ?? "apprentice_raft"],
  );
  airships.save({
    ...state,
    transaction: "recovery_required",
    recoveryFrom: "in_flight",
    damage: {
      hullDamage: report.hullPoints,
      damagedComponents: state.blueprint.components
        .filter(
          (component) => component.kind !== "core" && component.kind !== "seat",
        )
        .map(componentKey)
        .sort(),
    },
  });
  const owner = world
    .getAllPlayers()
    .find((player) => player.id === state.ownerPlayerId);
  owner?.sendMessage(
    "§cYour Skycraft was destroyed. Its exact blueprint will recover at the registered berth with a repair bill.§r",
  );
  logger.warn("Player-built Skycraft destroyed; recovery requested.", {
    airshipId,
  });
}

export function ensureApprenticeBerth(logger: Logger): boolean {
  return ensureBerthPlatform(
    skycraftBerth("apprentice_raft"),
    logger.child("apprentice-berth"),
  );
}

export interface DeveloperSkycraftBerthReport {
  prepared: string[];
  skipped: string[];
}

/**
 * Prepare every fixed certification berth for the explicit developer setup.
 *
 * The normal progression path still prepares pads one at a time. This helper
 * only invokes the same obstruction-safe platform service for each berth.
 */
export function prepareDeveloperSkycraftBerths(
  logger: Logger,
): DeveloperSkycraftBerthReport {
  const report: DeveloperSkycraftBerthReport = {
    prepared: [],
    skipped: [],
  };

  for (const definition of SKYCRAFT_BERTHS) {
    if (
      ensureBerthPlatform(definition, logger.child(definition.certification))
    ) {
      report.prepared.push(definition.berth.id);
    } else {
      report.skipped.push(definition.berth.id);
    }
  }

  return report;
}

export function runSkycraftSweep(logger: Logger): void {
  for (const id of airships.ids()) {
    const state = airships.load(id);
    if (state === undefined) {
      logger.error("Skycraft record failed to load.", { airshipId: id });
      continue;
    }

    const dimension = world.getDimension(state.blueprint.berth.dimensionId);
    const runtimeWorld = new BedrockRuntimeWorld(dimension);
    const executor = new SkycraftExecutor(airships, runtimeWorld);

    if (
      state.transaction === "validating" ||
      state.transaction === "launching" ||
      state.transaction === "docking" ||
      state.transaction === "recovery_required"
    ) {
      const recovered = executor.recover(state);
      if (recovered.ok) {
        logger.warn("Interrupted Skycraft transaction recovered.", {
          airshipId: id,
          state: recovered.state.transaction,
        });
      }
      continue;
    }

    if (
      state.transaction !== "in_flight" ||
      state.flightEntityId === undefined
    ) {
      continue;
    }

    const entity = world.getEntity(state.flightEntityId);
    if (entity === undefined || !entity.isValid) {
      const recovery: AirshipState = {
        ...state,
        transaction: "recovery_required",
        recoveryFrom: "in_flight",
      };
      airships.save(recovery);
      continue;
    }

    const rideable = entity.getComponent(EntityComponentTypes.Rideable) as
      EntityRideableComponent | undefined;
    const riders = rideable?.getRiders() ?? [];
    const certifiedSeats =
      1 +
      state.blueprint.components.filter(
        (component) => component.kind === "seat",
      ).length;
    let pilotId: string | undefined;

    for (let index = 0; index < riders.length; index += 1) {
      const rider = riders[index];
      const permitted =
        index < certifiedSeats &&
        canPerform(state, rider.id, index === 0 ? "pilot" : "passenger");
      if (!permitted) {
        rideable?.ejectRider(rider);
        if (rider.typeId === "minecraft:player") {
          (rider as Player).sendMessage(
            "§eYou are not assigned to that Skycraft seat.§r",
          );
        }
      } else if (index === 0) {
        pilotId = rider.id;
      }
    }

    if (state.activePilotId !== pilotId) {
      airships.save({ ...state, activePilotId: pilotId });
    }
  }
}

export async function showSkycraftDockmaster(
  player: Player,
  logger: Logger,
): Promise<void> {
  const playerMilestones = recordPlayerMilestones(player);
  const experimentalAccess = player.hasTag(
    SKYCRAFT_EXPERIMENTAL_CERTIFICATION_TAG,
  );
  const unlocked = activatedCertifications(
    playerMilestones,
    experimentalAccess,
  );
  const activatedIds = new Set(unlocked.map((entry) => entry.id));
  const actions: Array<{ label: string; run: () => void | Promise<void> }> = [];

  for (const certification of unlocked) {
    const definition = skycraftBerth(certification.id);
    actions.push({
      label: `Prepare ${displayCertification(certification.id)} Berth`,
      run: () => {
        if (ensureBerthPlatform(definition, logger)) {
          player.sendMessage(
            `§a${displayCertification(certification.id)} berth is ready at X=${definition.berth.origin.x}, Z=${definition.berth.origin.z}.§r`,
          );
        }
      },
    });
  }

  for (const reference of REFERENCE_BLUEPRINTS) {
    if (
      !activatedIds.has(reference.certification) ||
      (!experimentalAccess &&
        !canUseReferenceBlueprint(reference.id, playerMilestones))
    ) {
      continue;
    }
    actions.push({
      label: `Plan: ${reference.name}`,
      run: () => showReferencePlan(player, reference),
    });
    actions.push({
      label: `Build: ${reference.name}`,
      run: () => constructReference(player, reference, logger),
    });
  }

  for (const name of personalBlueprints.list(player.id, player.id) ?? []) {
    const saved = personalBlueprints.load(player.id, player.id, name);
    const definition = saved === undefined ? undefined : berthForSaved(saved);
    if (
      saved === undefined ||
      definition === undefined ||
      !activatedIds.has(definition.certification)
    ) {
      continue;
    }
    actions.push({
      label: `Plan Saved: ${name}`,
      run: () => showSavedBlueprintPlan(player, name, saved),
    });
    actions.push({
      label: `Build Saved: ${name}`,
      run: () => constructSavedBlueprint(player, name, saved, logger),
    });
  }

  let form = new ActionFormData()
    .title("Skycraft Dockyard")
    .body(
      [
        "Prepare a bounded berth, craft a Helm/Core/lift/engine, then build with approved wood.",
        "Reference orders consume every listed block plus an emerald labor fee.",
        "",
        `World certifications: ${unlocked.map((entry) => displayCertification(entry.id)).join(", ")}`,
        experimentalAccess
          ? "Experimental certification access is enabled for this tester."
          : "Advanced tiers remain performance-gated. Testers may use: /tag @s add skyknights.skycraft_experimental",
      ].join("\n"),
    );

  for (const action of actions) {
    form = form.button(action.label);
  }

  const response = await form.show(player);
  if (!response.canceled && response.selection !== undefined) {
    await actions[response.selection]?.run();
  }
}

async function showHelm(
  player: Player,
  position: { x: number; y: number; z: number },
  logger: Logger,
): Promise<void> {
  const definition = SKYCRAFT_BERTHS.find((candidate) =>
    berthContains(candidate.berth, position),
  );
  if (definition === undefined || !berthIsPrepared(definition)) {
    player.sendMessage(
      "§eThis Helm is outside a prepared Skycraft berth. Ask the Dockmaster to prepare one.§r",
    );
    return;
  }

  const existing = stateForBerth(definition.berth.id);
  if (
    existing !== undefined &&
    existing.ownerPlayerId !== player.id &&
    !canPerform(existing, player.id, "edit")
  ) {
    player.sendMessage(
      "§cOnly this Skycraft's owner or builder may use its Helm.§r",
    );
    return;
  }

  const assessment = assessBuild(player, position, definition, existing);
  const actions: Array<{ label: string; run: () => void | Promise<void> }> = [];

  if (ownerHelmActionAllowed(player.id, existing)) {
    actions.push({
      label: "Certify / Save Blueprint",
      run: () => {
        if (!ownerHelmActionAllowed(player.id, existing)) {
          player.sendMessage(
            "§cOnly the current owner may certify this Skycraft.§r",
          );
          return;
        }
        if (assessment.state === undefined) {
          sendAssessment(player, assessment);
          return;
        }
        airships.save(assessment.state);
        player.sendMessage(
          `§aBlueprint revision ${assessment.state.blueprint.revision} certified and saved.§r`,
        );
      },
    });
    if (existing === undefined || existing.ownerPlayerId === player.id) {
      actions.push({
        label: "Save to Personal Library",
        run: () => {
          if (!ownerHelmActionAllowed(player.id, existing)) {
            player.sendMessage(
              "§cOnly the current owner may save this Skycraft.§r",
            );
            return;
          }
          if (assessment.state === undefined) {
            sendAssessment(player, assessment);
            return;
          }
          const name = assessment.state.displayName ?? "Untitled Airship";
          const current = personalBlueprints.load(player.id, player.id, name);
          const saved = personalBlueprints.save(
            player.id,
            player.id,
            name,
            assessment.state.blueprint,
            current?.revision,
          );
          player.sendMessage(
            saved === undefined
              ? "§cThe personal blueprint could not be saved; check its name, size, and revision.§r"
              : `§aSaved personal blueprint "${name}" at library revision ${saved.revision}.§r`,
          );
        },
      });
    }
    actions.push({
      label: "Launch",
      run: () => {
        if (!ownerHelmActionAllowed(player.id, existing)) {
          player.sendMessage(
            "§cOnly the current owner may launch this Skycraft.§r",
          );
          return;
        }
        if (assessment.state === undefined) {
          sendAssessment(player, assessment);
          return;
        }
        airships.save(assessment.state);
        const result = new SkycraftExecutor(
          airships,
          new BedrockRuntimeWorld(player.dimension),
        ).launch(assessment.state, position);
        player.sendMessage(
          result.ok
            ? "§aSkycraft launched. Right-click to mount; crouch-interact for controls.§r"
            : `§cLaunch refused: ${result.reason ?? "unknown error"}§r`,
        );
      },
    });
  }

  if (existing !== undefined && existing.ownerPlayerId === player.id) {
    actions.push({
      label: "Manage Crew",
      run: () => showCrewManager(player, existing),
    });
    actions.push({
      label: "Dismantle Registration",
      run: () => {
        if (existing.transaction !== "docked") {
          player.sendMessage("§cDock the craft before dismantling it.§r");
          return;
        }
        airships.remove(existing.airshipId);
        player.sendMessage(
          "§eRegistration removed. The docked blocks and reusable Core remain in place.§r",
        );
      },
    });
  }
  if (
    existing !== undefined &&
    (existing.damage.hullDamage > 0 ||
      existing.damage.damagedComponents.length > 0) &&
    canPerform(existing, player.id, "repair")
  ) {
    const kits = repairKitCount(existing);
    actions.push({
      label: `Repair (${kits} Kit${kits === 1 ? "" : "s"})`,
      run: () => repairSkycraft(player, existing, kits),
    });
  }
  if (actions.length === 0) {
    actions.push({ label: "Close", run: () => undefined });
  }

  let form = new ActionFormData()
    .title(existing?.displayName ?? "Skycraft Helm")
    .body(assessmentText(assessment));
  for (const action of actions) {
    form = form.button(action.label);
  }
  const response = await form.show(player);
  if (!response.canceled && response.selection !== undefined) {
    await actions[response.selection]?.run();
  }
  logger.info("Skycraft Helm inspected.", {
    playerId: player.id,
    berthId: definition.berth.id,
    valid: assessment.state !== undefined,
  });
}

interface Assessment {
  state?: AirshipState;
  report?: ReturnType<typeof evaluateAirship>;
  diagnostics: readonly string[];
}

function assessBuild(
  player: Player,
  helmPosition: { x: number; y: number; z: number },
  definition: SkycraftBerthDefinition,
  existing?: AirshipState,
): Assessment {
  const currentMilestones = recordPlayerMilestones(player);
  const unlocked = activatedCertifications(
    currentMilestones,
    player.hasTag(SKYCRAFT_EXPERIMENTAL_CERTIFICATION_TAG),
  ).some((entry) => entry.id === definition.certification);
  if (!unlocked) {
    return {
      diagnostics: [
        `${displayCertification(definition.certification)} is not unlocked.`,
      ],
    };
  }

  const helmBlock = player.dimension.getBlock(helmPosition);
  if (
    definition.certification !== "apprentice_raft" &&
    helmBlock?.typeId !== SKYCRAFT_IDS.reinforcedHelm
  ) {
    return {
      diagnostics: ["Advanced berths require a Reinforced Helm."],
    };
  }

  if (existing !== undefined && existing.transaction !== "docked") {
    return {
      diagnostics: [
        `Editing is locked while the craft is ${existing.transaction}.`,
      ],
    };
  }

  const airshipId =
    existing?.airshipId ?? airships.nextId(player.id, definition.berth.id);
  const certification = SKYCRAFT_CERTIFICATIONS[definition.certification];
  const scan = scanAirship(
    createRuntimeBlockReader(new BedrockDimensionReader(player.dimension)),
    definition.berth,
    helmPosition,
    airshipId,
    certification.blockCap,
  );
  const scanDiagnostics = scan.diagnostics.map(
    (diagnostic) => diagnostic.message,
  );

  if (scan.helm === undefined || scanDiagnostics.length > 0) {
    return { diagnostics: scanDiagnostics };
  }

  const unavailableComponents = [
    ...new Set(
      scan.components
        .filter(
          (component) =>
            !componentAvailableAtCertification(
              component.typeId,
              definition.certification,
            ),
        )
        .map((component) => component.typeId),
    ),
  ].sort();
  if (unavailableComponents.length > 0) {
    return {
      diagnostics: unavailableComponents.map(
        (typeId) =>
          `${typeId} is not certified for ${displayCertification(definition.certification)}.`,
      ),
    };
  }

  const blueprint: AirshipBlueprint = {
    schemaVersion: 1,
    airshipId,
    revision: (existing?.blueprint.revision ?? 0) + 1,
    berth: definition.berth,
    helm: scan.helm,
    blocks: scan.blocks,
    components: scan.components,
    engineeringVersion: 1,
  };
  const report = evaluateAirship(blueprint, certification);

  if (!report.allowed) {
    return { report, diagnostics: report.diagnostics };
  }

  return {
    report,
    diagnostics: [],
    state: {
      schemaVersion: 1,
      airshipId,
      ownerPlayerId: existing?.ownerPlayerId ?? player.id,
      displayName:
        existing?.displayName ??
        `Skycraft ${airshipId.slice(-4).toUpperCase()}`,
      certificationId: definition.certification,
      referenceBlueprintId: existing?.referenceBlueprintId,
      crew: existing?.crew ?? [],
      transaction: "docked",
      blueprint,
      dockedHelmPosition: {
        ...helmPosition,
        dimensionId: definition.berth.dimensionId,
      },
      lastSafeLocation: existing?.lastSafeLocation,
      cargo: {
        authority: "disabled",
        reservedMassSubunits: report.cargoMassSubunits,
      },
      damage: existing?.damage ?? {
        hullDamage: 0,
        damagedComponents: [],
      },
    },
  };
}

async function showFlightControls(
  player: Player,
  entityId: string,
  logger: Logger,
): Promise<void> {
  const entity = world.getEntity(entityId);
  const airshipId = entity?.getDynamicProperty("skyknights:airship_id");
  const state =
    typeof airshipId === "string" ? airships.load(airshipId) : undefined;

  if (state === undefined || !canPerform(state, player.id, "dock")) {
    player.sendMessage("§cYou do not have authority to dock this Skycraft.§r");
    return;
  }

  const form = new ActionFormData()
    .title(state.displayName ?? "Skycraft Controls")
    .body(
      `State: ${state.transaction}\nBlueprint: r${state.blueprint.revision}\n\nDocking recalls the proxy to its registered clear berth.`,
    )
    .button("Dock at Registered Berth")
    .button("Recovery Status");
  const response = await form.show(player);
  if (response.canceled || response.selection === undefined) {
    return;
  }

  if (response.selection === 0) {
    const helm = state.dockedHelmPosition;
    if (helm === undefined) {
      player.sendMessage("§cNo registered Helm position is available.§r");
      return;
    }
    const result = new SkycraftExecutor(
      airships,
      new BedrockRuntimeWorld(
        world.getDimension(state.blueprint.berth.dimensionId),
      ),
    ).dock(state, helm);
    player.sendMessage(
      result.ok
        ? "§aSkycraft docked and its exact approved blocks were restored.§r"
        : `§cDocking refused: ${result.reason ?? "unknown error"}§r`,
    );
  } else {
    player.sendMessage(
      `§7${state.displayName ?? state.airshipId}: ${state.transaction}, blueprint r${state.blueprint.revision}.§r`,
    );
  }
  logger.info("Skycraft flight control used.", {
    playerId: player.id,
    airshipId: state.airshipId,
    selection: response.selection,
  });
}

async function showCrewManager(
  owner: Player,
  state: AirshipState,
): Promise<void> {
  const candidates = world
    .getAllPlayers()
    .filter((candidate) => candidate.id !== owner.id)
    .sort((left, right) => left.name.localeCompare(right.name));
  let playerForm = new ActionFormData()
    .title("Skycraft Crew")
    .body(
      state.crew.length === 0
        ? "No assigned crew."
        : state.crew
            .map(
              (member) =>
                `${member.playerId.slice(-8)}: ${member.roles.join(", ")}`,
            )
            .join("\n"),
    );
  for (const candidate of candidates) {
    playerForm = playerForm.button(candidate.name);
  }
  const playerResponse = await playerForm.show(owner);
  if (
    playerResponse.canceled ||
    playerResponse.selection === undefined ||
    candidates[playerResponse.selection] === undefined
  ) {
    return;
  }

  const candidate = candidates[playerResponse.selection];
  let roleForm = new ActionFormData()
    .title(`Assign ${candidate.name}`)
    .body(
      "Choose one server-authorized role. Reassigning replaces prior roles.",
    );
  for (const role of CREW_ROLES) {
    roleForm = roleForm.button(role);
  }
  roleForm = roleForm.button("Remove from Crew");
  const roleResponse = await roleForm.show(owner);
  if (roleResponse.canceled || roleResponse.selection === undefined) {
    return;
  }

  const role = CREW_ROLES[roleResponse.selection];
  const crew = state.crew.filter((member) => member.playerId !== candidate.id);
  if (role !== undefined) {
    crew.push({ playerId: candidate.id, roles: [role] });
  }
  airships.save({
    ...state,
    crew: crew.sort((left, right) =>
      left.playerId.localeCompare(right.playerId),
    ),
  });
  owner.sendMessage(
    role === undefined
      ? `§e${candidate.name} removed from the crew.§r`
      : `§a${candidate.name} assigned as ${role}.§r`,
  );
}

function repairKitCount(state: AirshipState): number {
  return (
    Math.ceil(Math.max(0, state.damage.hullDamage) / 40) +
    state.damage.damagedComponents.length
  );
}

function repairSkycraft(
  player: Player,
  displayedState: AirshipState,
  displayedKitCount: number,
): void {
  const state = airships.load(displayedState.airshipId);
  if (
    state === undefined ||
    state.transaction !== "docked" ||
    !canPerform(state, player.id, "repair")
  ) {
    player.sendMessage(
      "§cThe repair request is stale or you lack mechanic authority.§r",
    );
    return;
  }

  const kits = repairKitCount(state);
  if (kits === 0) {
    player.sendMessage("§aThis Skycraft no longer needs repairs.§r");
    return;
  }
  if (kits !== displayedKitCount) {
    player.sendMessage(
      `§eThe repair bill changed to ${kits} kit${kits === 1 ? "" : "s"}; reopen the Helm.§r`,
    );
    return;
  }

  const inventory = playerInventory(player);
  const plan = planMaterialConsumption(inventorySnapshot(inventory), [
    { itemId: "skyknights:repair_kit", count: kits },
  ]);
  if (plan === undefined) {
    player.sendMessage(
      `§cYou need ${kits} Repair Kit${kits === 1 ? "" : "s"}.§r`,
    );
    return;
  }
  const snapshots = plan.map((operation) => ({
    slot: operation.slot,
    stack: inventory.getItem(operation.slot)?.clone(),
  }));

  try {
    consumeMaterials(inventory, plan);
    airships.save({
      ...state,
      damage: { hullDamage: 0, damagedComponents: [] },
    });
  } catch (error) {
    for (const snapshot of snapshots) {
      inventory.setItem(snapshot.slot, snapshot.stack);
    }
    player.sendMessage(
      `§cRepair rolled back: ${
        error instanceof Error ? error.message : String(error)
      }§r`,
    );
    return;
  }
  player.sendMessage(
    `§a${state.displayName ?? "Skycraft"} repaired and cleared to recertify.§r`,
  );
}

function recordPlayerMilestones(
  player: Player,
): ReadonlySet<SkycraftMilestone> {
  const result = new Set<SkycraftMilestone>(["starter:resources_ready"]);
  const playerState = new PlayerStateRepository(
    player,
    STARTER_ISLAND.safeDock,
  ).load();
  const discoveries = new Set(playerState.discoveredIslandIds);
  for (const island of [
    "ember_outpost",
    "sunspire_reach",
    "verdant_hollow",
    "frostspire",
  ] as const) {
    if (discoveries.has(island)) {
      result.add(`discovery:${island}`);
    }
  }
  if (playerState.skycutterUnlocked) {
    result.add("unlock:skycutter_blueprint");
  }
  if (playerState.objective === "combat_complete") {
    result.add("objective:combat_complete");
  }

  const inventory = playerInventory(player);
  if (
    countItem(inventory, "minecraft:gold_ingot") > 0 &&
    countItem(inventory, "minecraft:copper_ingot") > 0
  ) {
    result.add("material:gold_copper");
  }
  if (countItem(inventory, "skyknights:froststeel_ingot") > 0) {
    result.add("material:froststeel");
  }
  if (countItem(inventory, "skyknights:relic_shard") >= 2) {
    result.add("material:relic_shards_2");
  }
  if (countItem(inventory, "skyknights:aether_core") > 0) {
    result.add("material:aether_core");
  }

  return milestones.record(result);
}

function stateForBerth(berthId: string): AirshipState | undefined {
  for (const id of airships.ids()) {
    const state = airships.load(id);
    if (state === undefined) {
      throw new Error(
        `Skycraft record ${id} is corrupt; berth ownership cannot be resolved safely.`,
      );
    }
    if (state.blueprint.berth.id === berthId) {
      return state;
    }
  }
  return undefined;
}

function ownerHelmActionAllowed(
  playerId: string,
  existing: AirshipState | undefined,
): boolean {
  if (existing === undefined) {
    return true;
  }
  const current = airships.load(existing.airshipId);
  return current !== undefined && canPerform(current, playerId, "launch");
}

function berthIsPrepared(definition: SkycraftBerthDefinition): boolean {
  return (
    world.getDynamicProperty(`${BERTH_MARKER_PREFIX}${definition.berth.id}`) ===
    true
  );
}

function ensureBerthPlatform(
  definition: SkycraftBerthDefinition,
  logger: Logger,
): boolean {
  if (berthIsPrepared(definition)) {
    return true;
  }
  const dimension = world.getDimension(definition.berth.dimensionId);
  const targets: Array<{ x: number; y: number; z: number }> = [];
  for (
    let x = definition.berth.origin.x;
    x < definition.berth.origin.x + definition.berth.size.x;
    x += 1
  ) {
    for (
      let z = definition.berth.origin.z;
      z < definition.berth.origin.z + definition.berth.size.z;
      z += 1
    ) {
      targets.push({ x, y: definition.platformY, z });
    }
  }
  const walkwayEnd =
    definition.berth.origin.z + Math.floor(definition.berth.size.z / 2);
  for (let z = Math.min(0, walkwayEnd); z <= Math.max(0, walkwayEnd); z += 1) {
    targets.push({ x: 19, y: definition.platformY, z });
  }

  for (const target of targets) {
    const block = dimension.getBlock(target);
    if (
      block === undefined ||
      (block.typeId !== "minecraft:air" && block.typeId !== PLATFORM_BLOCK)
    ) {
      logger.warn("Skycraft berth preparation found an obstruction.", {
        berthId: definition.berth.id,
        target,
        typeId: block?.typeId,
      });
      return false;
    }
  }

  for (const target of targets) {
    dimension.setBlockType(target, PLATFORM_BLOCK);
  }
  world.setDynamicProperty(
    `${BERTH_MARKER_PREFIX}${definition.berth.id}`,
    true,
  );
  logger.info("Skycraft berth prepared.", {
    berthId: definition.berth.id,
    blocks: targets.length,
  });
  return true;
}

function showReferencePlan(
  player: Player,
  reference: ReferenceBlueprint,
): void {
  const materials = [
    ...referenceMaterials(reference),
    {
      itemId: "minecraft:emerald",
      count: LABOR_FEES[reference.certification],
    },
  ];
  player.sendMessage(`§6${reference.name} construction plan:§r`);
  for (const material of materials) {
    player.sendMessage(`- ${material.count} × ${material.itemId}`);
  }
}

function berthForSaved(
  blueprint: AirshipBlueprint,
): SkycraftBerthDefinition | undefined {
  return SKYCRAFT_BERTHS.find(
    (candidate) => candidate.berth.id === blueprint.berth.id,
  );
}

function blueprintMaterials(
  blueprint: AirshipBlueprint,
): readonly { itemId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const block of blueprint.blocks) {
    counts.set(block.typeId, (counts.get(block.typeId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([itemId, count]) => ({ itemId, count }))
    .sort((left, right) => left.itemId.localeCompare(right.itemId));
}

function showSavedBlueprintPlan(
  player: Player,
  name: string,
  blueprint: AirshipBlueprint,
): void {
  player.sendMessage(`§6${name} personal construction plan:§r`);
  for (const material of blueprintMaterials(blueprint)) {
    player.sendMessage(`- ${material.count} × ${material.itemId}`);
  }
}

function constructSavedBlueprint(
  player: Player,
  name: string,
  saved: AirshipBlueprint,
  logger: Logger,
): void {
  const definition = berthForSaved(saved);
  if (definition === undefined) {
    player.sendMessage(
      "§cThat blueprint references an unavailable dock certification.§r",
    );
    return;
  }

  const active = activatedCertifications(
    recordPlayerMilestones(player),
    player.hasTag(SKYCRAFT_EXPERIMENTAL_CERTIFICATION_TAG),
  ).some((entry) => entry.id === definition.certification);
  if (!active) {
    player.sendMessage(
      "§cThat blueprint's certification is locked or still performance-gated.§r",
    );
    return;
  }
  if (!ensureBerthPlatform(definition, logger)) {
    player.sendMessage("§cThe saved-blueprint berth is obstructed.§r");
    return;
  }
  if (stateForBerth(definition.berth.id) !== undefined) {
    player.sendMessage(
      "§eDismantle the craft currently registered in that berth first.§r",
    );
    return;
  }

  const helmPosition = {
    x: definition.berth.origin.x + Math.floor(definition.berth.size.x / 2),
    y: definition.berth.origin.y,
    z: definition.berth.origin.z + Math.floor(definition.berth.size.z / 2),
  };
  const airshipId = airships.nextId(player.id, definition.berth.id);
  const materialized = personalBlueprints.materialize(
    player.id,
    player.id,
    name,
    airshipId,
  );
  if (materialized === undefined) {
    player.sendMessage(
      "§cThe personal blueprint could not be loaded safely.§r",
    );
    return;
  }

  const dimension = world.getDimension(definition.berth.dimensionId);
  const targets = materialized.blocks.map((block) => ({
    block,
    position: {
      x: helmPosition.x + block.x,
      y: helmPosition.y + block.y,
      z: helmPosition.z + block.z,
    },
  }));
  if (
    targets.some(
      ({ position }) =>
        dimension.getBlock(position)?.typeId !== "minecraft:air",
    )
  ) {
    player.sendMessage("§cClear every block from the blueprint berth first.§r");
    return;
  }

  const inventory = playerInventory(player);
  const plan = planMaterialConsumption(
    inventorySnapshot(inventory),
    blueprintMaterials(materialized),
  );
  if (plan === undefined) {
    showSavedBlueprintPlan(player, name, materialized);
    player.sendMessage(
      "§cThe complete personal-blueprint material list is not in your inventory.§r",
    );
    return;
  }

  const snapshots = plan.map((operation) => ({
    slot: operation.slot,
    stack: inventory.getItem(operation.slot)?.clone(),
  }));
  const placed: Array<{ x: number; y: number; z: number }> = [];

  try {
    consumeMaterials(inventory, plan);
    for (const target of targets) {
      dimension
        .getBlock(target.position)
        ?.setPermutation(
          requirePermutation(target.block.typeId, target.block.states),
        );
      placed.push(target.position);
    }
    const assessment = assessBuild(player, helmPosition, definition, undefined);
    if (
      assessment.state === undefined ||
      assessment.state.airshipId !== airshipId
    ) {
      throw new Error(
        assessment.diagnostics.join("; ") ||
          "The materialized airship ID did not match its registration.",
      );
    }
    airships.save({
      ...assessment.state,
      displayName: name,
    });
  } catch (error) {
    for (const position of placed) {
      dimension.setBlockType(position, "minecraft:air");
    }
    for (const snapshot of snapshots) {
      inventory.setItem(snapshot.slot, snapshot.stack);
    }
    player.sendMessage(
      `§cPersonal construction rolled back: ${
        error instanceof Error ? error.message : String(error)
      }§r`,
    );
    return;
  }

  player.sendMessage(
    `§a${name} was materialized from your saved plan and remains editable.§r`,
  );
}

function constructReference(
  player: Player,
  reference: ReferenceBlueprint,
  logger: Logger,
): void {
  const playerMilestones = recordPlayerMilestones(player);
  const experimentalAccess = player.hasTag(
    SKYCRAFT_EXPERIMENTAL_CERTIFICATION_TAG,
  );
  const activated = activatedCertifications(
    playerMilestones,
    experimentalAccess,
  ).some((entry) => entry.id === reference.certification);
  if (
    !activated ||
    (!experimentalAccess &&
      !canUseReferenceBlueprint(reference.id, playerMilestones))
  ) {
    player.sendMessage("§cThat reference blueprint is not unlocked.§r");
    return;
  }
  const definition = skycraftBerth(reference.certification);
  if (!ensureBerthPlatform(definition, logger)) {
    player.sendMessage("§cThe reference berth is obstructed.§r");
    return;
  }
  if (stateForBerth(definition.berth.id) !== undefined) {
    player.sendMessage(
      "§eThat certification berth already has a registered craft.§r",
    );
    return;
  }

  const layout = referenceLayout(reference);
  const helmPosition = {
    x: definition.berth.origin.x + Math.floor(definition.berth.size.x / 2),
    y: definition.berth.origin.y,
    z: definition.berth.origin.z + Math.floor(definition.berth.size.z / 2),
  };
  const dimension = world.getDimension(definition.berth.dimensionId);
  const targets = layout.map((block) => ({
    block,
    position: {
      x: helmPosition.x + block.x,
      y: helmPosition.y + block.y,
      z: helmPosition.z + block.z,
    },
  }));
  if (
    targets.some(
      ({ position }) =>
        dimension.getBlock(position)?.typeId !== "minecraft:air",
    )
  ) {
    player.sendMessage("§cClear every block from the reference berth first.§r");
    return;
  }

  const requirements = [
    ...referenceMaterials(reference),
    {
      itemId: "minecraft:emerald",
      count: LABOR_FEES[reference.certification],
    },
  ];
  const inventory = playerInventory(player);
  const plan = planMaterialConsumption(
    inventorySnapshot(inventory),
    requirements,
  );
  if (plan === undefined) {
    showReferencePlan(player, reference);
    player.sendMessage(
      "§cThe complete material list is not in your inventory.§r",
    );
    return;
  }

  const snapshots = plan.map((operation) => ({
    slot: operation.slot,
    stack: inventory.getItem(operation.slot)?.clone(),
  }));
  const placed: Array<{ x: number; y: number; z: number }> = [];

  try {
    consumeMaterials(inventory, plan);
    for (const target of targets) {
      dimension
        .getBlock(target.position)
        ?.setPermutation(
          requirePermutation(target.block.typeId, target.block.states),
        );
      placed.push(target.position);
    }
    const assessment = assessBuild(player, helmPosition, definition, undefined);
    if (assessment.state === undefined) {
      throw new Error(assessment.diagnostics.join("; "));
    }
    airships.save({
      ...assessment.state,
      displayName: reference.name,
      referenceBlueprintId: reference.id,
    });
  } catch (error) {
    for (const position of placed) {
      dimension.setBlockType(position, "minecraft:air");
    }
    for (const snapshot of snapshots) {
      inventory.setItem(snapshot.slot, snapshot.stack);
    }
    player.sendMessage(
      `§cConstruction order rolled back: ${
        error instanceof Error ? error.message : String(error)
      }§r`,
    );
    return;
  }

  player.sendMessage(
    `§a${reference.name} constructed, certified, and left editable in the berth.§r`,
  );
}

function requirePermutation(
  typeId: string,
  states: Readonly<Record<string, string | number | boolean>>,
): BlockPermutation {
  return BlockPermutation.resolve(typeId, { ...states });
}

function playerInventory(player: Player): Container {
  const inventory = player.getComponent(EntityComponentTypes.Inventory) as
    EntityInventoryComponent | undefined;
  if (inventory?.container === undefined) {
    throw new Error(`Player ${player.id} has no inventory.`);
  }
  return inventory.container;
}

function inventorySnapshot(container: Container): Array<ItemStack | undefined> {
  return Array.from({ length: container.size }, (_, slot) =>
    container.getItem(slot),
  );
}

function consumeMaterials(
  container: Container,
  plan: readonly MaterialConsumption[],
): void {
  for (const operation of plan) {
    const stack = container.getItem(operation.slot);
    if (
      stack === undefined ||
      stack.typeId !== operation.itemId ||
      stack.amount < operation.count
    ) {
      throw new Error("Inventory changed during construction.");
    }
    if (stack.amount === operation.count) {
      container.setItem(operation.slot);
    } else {
      stack.amount -= operation.count;
      container.setItem(operation.slot, stack);
    }
  }
}

function countItem(container: Container, itemId: string): number {
  let count = 0;
  for (let slot = 0; slot < container.size; slot += 1) {
    const stack = container.getItem(slot);
    if (stack?.typeId === itemId) {
      count += stack.amount;
    }
  }
  return count;
}

function assessmentText(assessment: Assessment): string {
  const lines = assessment.report
    ? [
        `Blocks: ${assessment.state?.blueprint.blocks.length ?? "invalid"}`,
        `Mass: ${assessment.report.massSubunits}/2`,
        `Lift: ${assessment.report.liftSubunits} (needs ${assessment.report.requiredLiftSubunits})`,
        `Thrust: ${assessment.report.forwardThrust}`,
        `Control: ${assessment.report.lateralControl}`,
        `Handling: ${assessment.report.handling}`,
      ]
    : [];
  if (assessment.diagnostics.length > 0) {
    lines.push("", "Launch blockers:", ...assessment.diagnostics);
  } else {
    lines.push("", "Certified for launch.");
  }
  return lines.join("\n");
}

function sendAssessment(player: Player, assessment: Assessment): void {
  for (const message of assessment.diagnostics) {
    player.sendMessage(`§c${message}§r`);
  }
}

function displayCertification(id: CertificationId): string {
  const names: Readonly<Record<CertificationId, string>> = {
    apprentice_raft: "Apprentice Raft",
    ember_skiff: "Ember Skiff",
    specialist_airframe: "Specialist Airframe",
    expedition_skycraft: "Expedition Skycraft",
    masterwork_skycraft: "Masterwork Skycraft",
  };
  return names[id];
}
