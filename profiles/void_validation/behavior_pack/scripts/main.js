import { system, world } from "@minecraft/server";

const MARKER_PREFIX = "SKY_KNIGHTS_VOID_VALIDATION ";
const PHASE_PROPERTY = "skyknights:void_validation_phase";
const TRIGGER_ID = "skyknights:void_validate";
const EXPECTED_HEIGHT = {
  min: -64,
  maxExclusive: 320,
};
const PHASE_CHUNKS = {
  1: [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 0],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
    [128, 0],
    [-128, 0],
    [0, 128],
    [0, -128],
  ],
  2: [
    [256, 256],
    [-256, 256],
    [256, -256],
    [-256, -256],
  ],
};

let running = false;

function marker(value) {
  console.warn(`${MARKER_PREFIX}${JSON.stringify(value)}`);
}

function currentPhase() {
  const completed = world.getDynamicProperty(PHASE_PROPERTY);

  if (completed === undefined) {
    return 1;
  }

  if (completed === 1) {
    return 2;
  }

  throw new Error(
    `Unexpected ${PHASE_PROPERTY} value ${JSON.stringify(completed)}.`,
  );
}

function fail(phase, error, location) {
  marker({
    status: "failed",
    phase,
    reason: error instanceof Error ? error.message : String(error),
    location,
  });
}

function blockAt(dimension, location) {
  try {
    return dimension.getBlock(location);
  } catch (error) {
    throw new Error(
      `Block ${location.x},${location.y},${location.z} is not loaded: ${
        error instanceof Error ? error.message : String(error)
      }.`,
    );
  }
}

function* scan(phase) {
  const dimension = world.getDimension("minecraft:overworld");
  const { min, max } = dimension.heightRange;

  if (min !== EXPECTED_HEIGHT.min || max !== EXPECTED_HEIGHT.maxExclusive) {
    fail(
      phase,
      `Unexpected Overworld height range ${min}..${max}; expected ${EXPECTED_HEIGHT.min}..${EXPECTED_HEIGHT.maxExclusive}.`,
    );
    return;
  }

  const chunks = PHASE_CHUNKS[phase];
  let scannedBlocks = 0;

  for (const [chunkX, chunkZ] of chunks) {
    const minX = chunkX * 16;
    const minZ = chunkZ * 16;
    const readinessProbe = { x: minX, y: 0, z: minZ };

    if (blockAt(dimension, readinessProbe) === undefined) {
      fail(phase, "A required chunk is not loaded.", readinessProbe);
      return;
    }

    for (let x = minX; x < minX + 16; x += 1) {
      for (let z = minZ; z < minZ + 16; z += 1) {
        for (let y = min; y < max; y += 1) {
          const location = { x, y, z };
          const block = blockAt(dimension, location);

          if (block === undefined) {
            fail(phase, "A scanned block is not loaded.", location);
            return;
          }

          if (block.typeId !== "minecraft:air") {
            fail(
              phase,
              `Expected minecraft:air, found ${block.typeId}.`,
              location,
            );
            return;
          }

          scannedBlocks += 1;

          if (scannedBlocks % 2_048 === 0) {
            yield;
          }
        }
      }
    }
  }

  world.setDynamicProperty(PHASE_PROPERTY, phase);
  marker({
    status: "passed",
    phase,
    chunks,
    heightMin: min,
    heightMaxExclusive: max,
    scannedBlocks,
  });
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== TRIGGER_ID || running) {
    return;
  }

  running = true;

  try {
    system.runJob(scan(currentPhase()));
  } catch (error) {
    fail(0, error);
  }
});

system.run(() => {
  try {
    marker({
      status: "ready",
      phase: currentPhase(),
    });
  } catch (error) {
    fail(0, error);
  }
});
