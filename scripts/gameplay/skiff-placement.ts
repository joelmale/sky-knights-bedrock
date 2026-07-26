export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

const SKIFF_SPAWN_DISTANCE = 4;

export function getSkiffSpawnLocation(
  playerLocation: Vector3Like,
  viewDirection: Vector3Like,
): Vector3Like {
  return {
    x: playerLocation.x + viewDirection.x * SKIFF_SPAWN_DISTANCE,
    y: playerLocation.y,
    z: playerLocation.z + viewDirection.z * SKIFF_SPAWN_DISTANCE,
  };
}
