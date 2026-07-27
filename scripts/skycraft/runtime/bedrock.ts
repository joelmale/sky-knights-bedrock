import { BlockPermutation, Dimension, Entity, world } from "@minecraft/server";

import { SKYCRAFT_IDS } from "../config";
import { AirshipState, BlockPosition } from "../types";
import { approvedStates, RuntimeDimension } from "./block-reader";
import { RuntimeWorld } from "./executor";
import { DynamicPropertyHost } from "./repository";

const TIER_EVENTS = {
  apprentice_raft: "skyknights:configure_apprentice",
  ember_skiff: "skyknights:configure_ember",
  specialist_airframe: "skyknights:configure_specialist",
  expedition_skycraft: "skyknights:configure_expedition",
  masterwork_skycraft: "skyknights:configure_masterwork",
} as const;

const VISUAL_EVENTS: Readonly<Record<string, string>> = {
  minnow: "skyknights:visual_minnow",
  dart: "skyknights:visual_dart",
  cargo_punt: "skyknights:visual_wayfarer",
  cloudwhale: "skyknights:visual_cloudwhale",
  aether_disc: "skyknights:visual_disc",
  frostwing: "skyknights:visual_frostwing",
  surveyor: "skyknights:visual_surveyor",
  grand_cruiser: "skyknights:visual_grand",
};

function entityOrThrow(id: string): Entity {
  const entity = world.getEntity(id);
  if (entity === undefined || !entity.isValid) {
    throw new Error(`Skycraft flight entity ${id} is unavailable.`);
  }
  return entity;
}

function proxyEvent(state: AirshipState): string {
  const reference =
    state.referenceBlueprintId === undefined
      ? undefined
      : VISUAL_EVENTS[state.referenceBlueprintId];
  if (reference !== undefined) {
    return reference;
  }

  const types = new Set(
    state.blueprint.components.map((component) => component.typeId),
  );
  if (types.has(SKYCRAFT_IDS.airbag)) {
    return "skyknights:visual_cloudwhale";
  }
  if (types.has(SKYCRAFT_IDS.cannonHardpoint)) {
    return "skyknights:visual_frostwing";
  }
  if (types.has(SKYCRAFT_IDS.aetherLiftCell)) {
    return "skyknights:visual_disc";
  }
  if (state.certificationId === "masterwork_skycraft") {
    return "skyknights:visual_grand";
  }
  if (state.certificationId === "expedition_skycraft") {
    return "skyknights:visual_surveyor";
  }
  if (state.certificationId === "ember_skiff") {
    return "skyknights:visual_dart";
  }
  return "skyknights:visual_minnow";
}

export class WorldDynamicPropertyHost implements DynamicPropertyHost {
  public getDynamicProperty(identifier: string): string | undefined {
    const value = world.getDynamicProperty(identifier);
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== "string") {
      throw new Error(`Dynamic property ${identifier} is not a string.`);
    }
    return value;
  }

  public setDynamicProperty(identifier: string, value?: string): void {
    world.setDynamicProperty(identifier, value);
  }
}

export class BedrockDimensionReader implements RuntimeDimension {
  public constructor(private readonly dimension: Dimension) {}

  public getBlock(position: BlockPosition) {
    const block = this.dimension.getBlock(position);
    if (
      block === undefined ||
      block.typeId === "minecraft:air" ||
      block.typeId === "minecraft:cave_air" ||
      block.typeId === "minecraft:void_air"
    ) {
      return undefined;
    }
    return {
      typeId: block.typeId,
      states: approvedStates(block.permutation.getAllStates()),
    };
  }
}

export class BedrockRuntimeWorld implements RuntimeWorld {
  public constructor(private readonly dimension: Dimension) {}

  public getBlock(position: BlockPosition) {
    return new BedrockDimensionReader(this.dimension).getBlock(position);
  }

  public setBlock(
    position: BlockPosition,
    block?: {
      typeId: string;
      states: Readonly<Record<string, string | number | boolean>>;
    },
  ): void {
    const target = this.dimension.getBlock(position);
    if (target === undefined) {
      throw new Error(
        `Block ${position.x},${position.y},${position.z} is unavailable.`,
      );
    }

    if (block === undefined) {
      target.setType("minecraft:air");
      return;
    }

    target.setPermutation(
      BlockPermutation.resolve(block.typeId, { ...block.states }),
    );
  }

  public spawnFlight(
    typeId: typeof SKYCRAFT_IDS.flightEntity,
    position: BlockPosition,
  ): string {
    return this.dimension.spawnEntity(typeId, position, {
      initialPersistence: true,
    }).id;
  }

  public configureFlight(entityId: string, state: AirshipState): void {
    const entity = entityOrThrow(entityId);
    const tierEvent = TIER_EVENTS[state.certificationId ?? "apprentice_raft"];
    entity.triggerEvent(tierEvent);
    entity.triggerEvent(proxyEvent(state));
    entity.triggerEvent("skyknights:disable_cargo");
    entity.triggerEvent("skyknights:on_tame");
    entity.setDynamicProperty("skyknights:airship_id", state.airshipId);
    entity.addTag("skyknights.airship");
    entity.addTag(`skyknights.airship.${state.airshipId}`);
    entity.nameTag = state.displayName ?? "Player-built Skycraft";
  }

  public removeFlight(entityId: string): void {
    entityOrThrow(entityId).remove();
  }

  public flightExists(entityId: string): boolean {
    const entity = world.getEntity(entityId);
    return entity !== undefined && entity.isValid;
  }
}
