export interface BlockVector {
  x: number;
  y: number;
  z: number;
}

export interface StructureBounds {
  from: BlockVector;
  to: BlockVector;
}

export function structureBounds(
  origin: BlockVector,
  size: BlockVector,
): StructureBounds {
  return {
    from: { ...origin },
    to: {
      x: origin.x + size.x - 1,
      y: origin.y + size.y - 1,
      z: origin.z + size.z - 1,
    },
  };
}

export function addBlockVectors(
  left: BlockVector,
  right: BlockVector,
): BlockVector {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
  };
}
