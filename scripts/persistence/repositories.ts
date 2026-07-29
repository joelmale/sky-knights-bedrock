import {
  DockLocation,
  PlayerState,
  ShipFrame,
  ShipState,
  WorldState,
  migrateWorldState,
  parsePlayerState,
  parseShipState,
} from "./schema";
import { compactWorldDocument, expandWorldDocument } from "./compact";

type DynamicPropertyValue =
  boolean | number | string | { x: number; y: number; z: number } | undefined;

export interface DynamicPropertyHost {
  getDynamicProperty(identifier: string): DynamicPropertyValue;
  setDynamicProperty(identifier: string, value?: DynamicPropertyValue): void;
}

const PROPERTY_KEYS = {
  world: "skyknights:world_state",
  player: "skyknights:player_state",
  ship: "skyknights:ship_state",
} as const;

function readJson(host: DynamicPropertyHost, key: string): unknown {
  const serialized = host.getDynamicProperty(key);

  if (serialized === undefined) {
    return undefined;
  }

  if (typeof serialized !== "string") {
    throw new Error(`Dynamic property ${key} must contain serialized JSON.`);
  }

  return JSON.parse(serialized) as unknown;
}

function writeJson(
  host: DynamicPropertyHost,
  key: string,
  value: unknown,
): void {
  host.setDynamicProperty(key, JSON.stringify(value));
}

function writeJsonIfChanged(
  host: DynamicPropertyHost,
  key: string,
  value: unknown,
): void {
  const serialized = JSON.stringify(value);

  if (host.getDynamicProperty(key) !== serialized) {
    host.setDynamicProperty(key, serialized);
  }
}

export class WorldStateRepository {
  public constructor(
    private readonly host: DynamicPropertyHost,
    private readonly createSeed: () => number,
  ) {}

  public load(): WorldState {
    const state = migrateWorldState(
      expandWorldDocument(readJson(this.host, PROPERTY_KEYS.world)),
      this.createSeed,
    );
    writeJsonIfChanged(
      this.host,
      PROPERTY_KEYS.world,
      compactWorldDocument(state),
    );
    return state;
  }

  public save(state: WorldState): void {
    // Compaction happens only here, at the serialisation boundary. WorldState
    // keeps its string[] shape in memory so no consumer has to know about it.
    writeJson(this.host, PROPERTY_KEYS.world, compactWorldDocument(state));
  }

  public update(mutator: (state: WorldState) => WorldState): WorldState {
    const next = mutator(this.load());
    this.save(next);
    return next;
  }
}

export class PlayerStateRepository {
  public constructor(
    private readonly host: DynamicPropertyHost,
    private readonly fallbackDock: DockLocation,
  ) {}

  public load(): PlayerState {
    const state = parsePlayerState(
      readJson(this.host, PROPERTY_KEYS.player),
      this.fallbackDock,
    );
    writeJsonIfChanged(this.host, PROPERTY_KEYS.player, state);
    return state;
  }

  public save(state: PlayerState): void {
    writeJson(this.host, PROPERTY_KEYS.player, state);
  }
}

export class ShipStateRepository {
  public constructor(
    private readonly host: DynamicPropertyHost,
    private readonly fallbackId: string,
    private readonly fallbackDock: DockLocation,
    private readonly fallbackFrame: ShipFrame = "skiff",
  ) {}

  public load(): ShipState {
    const state = parseShipState(
      readJson(this.host, PROPERTY_KEYS.ship),
      this.fallbackId,
      this.fallbackDock,
      this.fallbackFrame,
    );
    writeJsonIfChanged(this.host, PROPERTY_KEYS.ship, state);
    return state;
  }

  public save(state: ShipState): void {
    writeJson(this.host, PROPERTY_KEYS.ship, state);
  }
}
