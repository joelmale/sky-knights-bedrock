import { describe, expect, it } from "vitest";

import {
  CONTINENT_MAX_SMOOTH_STEP,
  CONTINENT_MAX_SPAN,
  CONTINENT_MIN_SPAN,
  CONTINENT_UNIT,
  buildColumn,
  columnAt,
  createContinentField,
  falloffAt,
  falloffFor,
  integerSquareRoot,
  isLand,
  maxColumnHeight,
  smoothSurfaceY,
  strataAt,
  strataForSurface,
  surfaceY,
  warpedDistance,
  type ContinentField,
} from "../scripts/generation/continent-field";

const SEED = 0x5c07f1ed;

function field(span: number, seed = SEED, index = 0): ContinentField {
  return createContinentField(seed, index, {
    span,
    center: { x: 0, z: 0 },
  });
}

/** Walk every column of a footprint once, relative to the centre. */
function forEachColumn(
  target: ContinentField,
  visit: (x: number, z: number) => void,
  step = 1,
): void {
  const r = target.radius;
  for (let dz = -r; dz <= r; dz += step) {
    for (let dx = -r; dx <= r; dx += step) {
      visit(target.centerX + dx, target.centerZ + dz);
    }
  }
}

describe("continent field descriptor", () => {
  it("honours a planner-owned centre; the ring is tooling-only fallback", () => {
    const center = { x: -123_456, z: 654_321 };
    const planned = createContinentField(SEED, 4, { span: 600, center });
    const toolingFallback = createContinentField(SEED, 4, { span: 600 });

    expect(planned.centerX).toBe(center.x);
    expect(planned.centerZ).toBe(center.z);
    expect(toolingFallback.centerX === center.x).toBe(false);
    expect(toolingFallback.centerZ === center.z).toBe(false);
  });

  it("rejects a planner centre outside Minecraft's safe coordinate range", () => {
    expect(() =>
      createContinentField(SEED, 0, {
        center: { x: 30_000_001, z: 0 },
      }),
    ).toThrow(RangeError);
  });

  it("keeps tooling fallback arithmetic inside the safe integer range", () => {
    expect(() =>
      createContinentField(SEED, 0, { ringRadius: 8_000_001 }),
    ).toThrow(RangeError);
  });

  it("is fully derived from the seed and continent index", () => {
    const a = createContinentField(SEED, 3, { span: 900 });
    const b = createContinentField(SEED, 3, { span: 900 });
    expect(a).toEqual(b);
  });

  it("separates continents by index and by seed", () => {
    const a = createContinentField(SEED, 0);
    const b = createContinentField(SEED, 1);
    const c = createContinentField(SEED + 1, 0);

    expect(a.centerX === b.centerX && a.centerZ === b.centerZ).toBe(false);
    expect(a.centerX === c.centerX && a.centerZ === c.centerZ).toBe(false);
    expect(a.seeds.ridge).not.toBe(b.seeds.ridge);
  });

  it("clamps the span into the design doc's 600-1800 range", () => {
    expect(field(10).span).toBe(CONTINENT_MIN_SPAN);
    expect(field(100000).span).toBe(CONTINENT_MAX_SPAN);
    expect(field(1201).span).toBe(1200);
  });

  it("holds only integers", () => {
    for (const span of [600, 1200, 1800]) {
      const target = field(span);
      const values: readonly (readonly [string, number])[] = [
        ["worldSeed", target.worldSeed],
        ["continentIndex", target.continentIndex],
        ["version", target.version],
        ["centerX", target.centerX],
        ["centerZ", target.centerZ],
        ["span", target.span],
        ["radius", target.radius],
        ["falloffRadius", target.falloffRadius],
        ["warpAmplitude", target.warpAmplitude],
        ["warpShift", target.warpShift],
        ["baseY", target.baseY],
        ["amplitude", target.amplitude],
        ["ridgeAmplitude", target.ridgeAmplitude],
        ["surfaceDepth", target.surfaceDepth],
        ["subsurfaceDepth", target.subsurfaceDepth],
        ["shoreThreshold", target.shoreThreshold],
        ["warpX", target.seeds.warpX],
        ["warpZ", target.seeds.warpZ],
        ["ridge", target.seeds.ridge],
        ["lake", target.seeds.lake],
      ];

      for (const [key, value] of values) {
        expect(Number.isSafeInteger(value), `${key}=${value}`).toBe(true);
      }
    }
  });

  it("sizes the falloff radius so warping cannot reach the declared radius", () => {
    for (const span of [600, 900, 1200, 1500, 1800]) {
      const target = field(span);
      expect(target.radius).toBe(span / 2);
      expect(target.falloffRadius + target.warpAmplitude).toBeLessThan(
        target.radius,
      );
      expect(target.falloffRadius).toBeGreaterThan(0);
    }
  });

  it("grows elevation with span but stays near the 52-block deck spacing", () => {
    const small = field(600);
    const large = field(1800);
    expect(large.amplitude).toBeGreaterThan(small.amplitude);
    expect(maxColumnHeight(small)).toBeLessThanOrEqual(64);
    expect(maxColumnHeight(large)).toBeLessThanOrEqual(96);
  });
});

describe("integer arithmetic", () => {
  it("computes exact integer square roots", () => {
    expect(integerSquareRoot(0)).toBe(0);
    expect(integerSquareRoot(-5)).toBe(0);
    for (let n = 1; n < 400; n += 1) {
      const root = integerSquareRoot(n * n);
      expect(root).toBe(n);
      expect(integerSquareRoot(n * n - 1)).toBe(n - 1);
    }
  });

  it("returns integers everywhere, including at extreme coordinates", () => {
    for (const origin of [0, 30000, -30000, 8000000, -8000000]) {
      const target = createContinentField(SEED, 0, {
        span: 1200,
        center: { x: origin, z: -origin },
      });

      for (let step = -600; step <= 600; step += 37) {
        const x = target.centerX + step;
        const z = target.centerZ - step;
        const column = columnAt(target, x, z);

        for (const value of [
          surfaceY(target, x, z),
          smoothSurfaceY(target, x, z),
          falloffFor(target, x, z),
          warpedDistance(target, x, z),
          column.surfaceY,
          column.smoothY,
          column.solidTopY,
          column.waterTopY,
          column.falloff,
        ]) {
          expect(Number.isSafeInteger(value)).toBe(true);
        }
      }
    }
  });

  it("keeps falloff inside the fixed-point unit range", () => {
    const target = field(1800);
    for (let distance = 0; distance <= target.radius + 50; distance += 1) {
      const value = falloffAt(target, distance);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(CONTINENT_UNIT);
    }
    expect(falloffAt(target, 0)).toBe(CONTINENT_UNIT);
    expect(falloffAt(target, target.falloffRadius)).toBe(0);
    expect(falloffAt(target, target.radius)).toBe(0);
  });
});

describe("determinism", () => {
  it("produces identical output across repeated evaluation", () => {
    const target = field(1200);
    const samples: number[] = [];

    for (let index = 0; index < 500; index += 1) {
      const x = target.centerX + ((index * 37) % 811) - 400;
      const z = target.centerZ + ((index * 53) % 811) - 400;
      samples.push(surfaceY(target, x, z));
    }

    for (let pass = 0; pass < 3; pass += 1) {
      for (let index = 0; index < 500; index += 1) {
        const x = target.centerX + ((index * 37) % 811) - 400;
        const z = target.centerZ + ((index * 53) % 811) - 400;
        expect(surfaceY(target, x, z)).toBe(samples[index]);
      }
    }
  });

  it("is unaffected by the anchor cache", () => {
    const target = field(600);
    const cache = new Map<number, number>();

    forEachColumn(
      target,
      (x, z) => {
        expect(buildColumn(target, x, z, cache)).toEqual(
          buildColumn(target, x, z),
        );
      },
      53,
    );
  }, 120000);

  it("gives different terrain for different seeds", () => {
    const a = createContinentField(1, 0, { span: 600, center: { x: 0, z: 0 } });
    const b = createContinentField(2, 0, { span: 600, center: { x: 0, z: 0 } });

    let differences = 0;
    for (let step = -200; step <= 200; step += 7) {
      if (surfaceY(a, step, step) !== surfaceY(b, step, step)) differences += 1;
    }
    expect(differences).toBeGreaterThan(20);
  });
});

describe("coastline", () => {
  it("closes inside the declared radius", () => {
    for (const span of [600, 1800]) {
      const target = field(span);
      let maxLandDistanceSquared = 0;
      let landColumns = 0;

      forEachColumn(target, (x, z) => {
        if (!isLand(target, x, z)) return;
        landColumns += 1;
        const dx = x - target.centerX;
        const dz = z - target.centerZ;
        const distanceSquared = dx * dx + dz * dz;
        if (distanceSquared > maxLandDistanceSquared) {
          maxLandDistanceSquared = distanceSquared;
        }
      });

      expect(landColumns).toBeGreaterThan(0);
      expect(integerSquareRoot(maxLandDistanceSquared)).toBeLessThan(
        target.radius,
      );
    }
  }, 120000);

  it("closes by construction, not by the safety clamp", () => {
    // The clamp in `falloffFor` is belt and braces. Warped distance alone must
    // already push every land column inside the radius.
    const target = field(1200);
    let maxLandDistance = 0;

    forEachColumn(
      target,
      (x, z) => {
        const warped = warpedDistance(target, x, z);
        if (falloffAt(target, warped) < target.shoreThreshold) return;
        const dx = x - target.centerX;
        const dz = z - target.centerZ;
        const distance = integerSquareRoot(dx * dx + dz * dz);
        if (distance > maxLandDistance) maxLandDistance = distance;
      },
      3,
    );

    expect(maxLandDistance).toBeLessThan(target.radius);
    expect(maxLandDistance).toBeGreaterThan(target.falloffRadius);
  }, 120000);

  it("is organic rather than a disc", () => {
    const target = field(1200);
    let shortest = Number.POSITIVE_INFINITY;
    let longest = 0;

    // Walk 64 rays outward and record where each one leaves the land.
    for (let ray = 0; ray < 64; ray += 1) {
      const angle = (ray * 2 * Math.PI) / 64;
      const stepX = Math.cos(angle);
      const stepZ = Math.sin(angle);
      let reach = 0;

      for (let distance = 1; distance <= target.radius; distance += 1) {
        const x = target.centerX + Math.round(stepX * distance);
        const z = target.centerZ + Math.round(stepZ * distance);
        if (isLand(target, x, z)) reach = distance;
      }

      if (reach < shortest) shortest = reach;
      if (reach > longest) longest = reach;
    }

    // A pure radial falloff would give the same reach on every ray. Domain
    // warping must spread it by a wide margin: that spread is the bays and
    // peninsulas.
    expect(longest - shortest).toBeGreaterThan(Math.floor(target.radius / 6));
  });

  it("has land at the centre and open sky outside", () => {
    const target = field(600);
    expect(isLand(target, target.centerX, target.centerZ)).toBe(true);
    expect(isLand(target, target.centerX + target.radius, target.centerZ)).toBe(
      false,
    );
    expect(
      surfaceY(target, target.centerX + target.radius, target.centerZ),
    ).toBe(target.baseY - 1);
  });

  it("gives the shore a real thickness rather than a one-block taper", () => {
    const target = field(600);
    let thinnest = Number.POSITIVE_INFINITY;

    forEachColumn(target, (x, z) => {
      const column = columnAt(target, x, z);
      if (!column.land) return;
      const thickness = column.solidTopY - column.bottomY + 1;
      if (thickness < thinnest) thinnest = thickness;
    });

    expect(thinnest).toBeGreaterThanOrEqual(3);
  }, 120000);
});

describe("relief", () => {
  it("never drives the surface below the base", () => {
    const target = field(1800);
    forEachColumn(
      target,
      (x, z) => {
        const column = columnAt(target, x, z);
        if (!column.land) return;
        expect(column.surfaceY).toBeGreaterThanOrEqual(column.smoothY);
        expect(column.smoothY).toBeGreaterThanOrEqual(target.baseY);
      },
      7,
    );
  }, 120000);

  it("stays under the amplitude envelope", () => {
    const target = field(1800);
    const ceiling = target.baseY + target.amplitude + target.ridgeAmplitude;
    forEachColumn(
      target,
      (x, z) => {
        expect(surfaceY(target, x, z)).toBeLessThanOrEqual(ceiling);
      },
      5,
    );
  }, 120000);

  it("actually varies: ridge detail is present", () => {
    const target = field(600);
    const heights = new Set<number>();
    for (let step = -100; step <= 100; step += 1) {
      heights.add(surfaceY(target, target.centerX + step, target.centerZ));
    }
    expect(heights.size).toBeGreaterThan(4);
  });

  it("bounds the smooth surface step between adjacent columns", () => {
    // The lake seal is derived from this bound. If it ever fails, lakes can
    // leak and CONTINENT_MAX_SMOOTH_STEP must be raised with LAKE_SINK.
    for (const span of [600, 1800]) {
      const target = field(span);
      let worst = 0;

      forEachColumn(target, (x, z) => {
        const here = smoothSurfaceY(target, x, z);
        for (const [dx, dz] of [
          [1, 0],
          [0, 1],
        ] as const) {
          const delta = Math.abs(smoothSurfaceY(target, x + dx, z + dz) - here);
          if (delta > worst) worst = delta;
        }
      });

      expect(worst).toBeLessThanOrEqual(CONTINENT_MAX_SMOOTH_STEP);
    }
  }, 120000);
});

describe("strata", () => {
  it("layers surface over subsurface over core", () => {
    const target = field(600);
    const top = target.baseY + 30;
    const bands: string[] = [];
    for (let y = top + 1; y >= target.baseY - 1; y -= 1) {
      bands.push(strataForSurface(target, top, y));
    }

    expect(bands[0]).toBe("air");
    expect(bands.slice(1, 1 + target.surfaceDepth)).toEqual(
      new Array(target.surfaceDepth).fill("surface"),
    );
    expect(
      bands.slice(
        1 + target.surfaceDepth,
        1 + target.surfaceDepth + target.subsurfaceDepth,
      ),
    ).toEqual(new Array(target.subsurfaceDepth).fill("subsurface"));
    expect(bands[bands.length - 2]).toBe("core");
    expect(bands[bands.length - 1]).toBe("air");
  });

  it("reports air for every Y of an open-sky column", () => {
    const target = field(600);
    const column = columnAt(
      target,
      target.centerX + target.radius,
      target.centerZ,
    );
    expect(column.land).toBe(false);
    for (let y = target.baseY - 4; y <= target.baseY + 80; y += 1) {
      expect(strataAt(target, column, y)).toBe("air");
    }
  });

  it("leaves no floating blocks: every solid column is continuous", () => {
    for (const span of [600, 1800]) {
      const target = field(span);

      forEachColumn(
        target,
        (x, z) => {
          const column = columnAt(target, x, z);
          if (!column.land) {
            expect(column.solidTopY).toBeLessThan(column.bottomY);
            return;
          }

          expect(column.solidTopY).toBeGreaterThanOrEqual(column.bottomY);
          expect(strataAt(target, column, column.bottomY - 1)).toBe("air");

          for (let y = column.bottomY; y <= column.solidTopY; y += 1) {
            const band = strataAt(target, column, y);
            expect(
              band === "core" || band === "subsurface" || band === "surface",
            ).toBe(true);
          }

          const above = Math.max(column.solidTopY, column.waterTopY) + 1;
          expect(strataAt(target, column, above)).toBe("air");
          expect(strataAt(target, column, above + 20)).toBe("air");
        },
        span === 600 ? 3 : 11,
      );
    }
  }, 120000);

  it("puts water directly on the lake bed with no air between", () => {
    const target = field(600);
    let lakes = 0;

    forEachColumn(target, (x, z) => {
      const column = columnAt(target, x, z);
      if (!column.lake) return;
      lakes += 1;

      expect(column.waterTopY).toBeGreaterThan(column.solidTopY);
      for (let y = column.solidTopY + 1; y <= column.waterTopY; y += 1) {
        expect(strataAt(target, column, y)).toBe("water");
      }
      expect(strataAt(target, column, column.solidTopY)).not.toBe("water");
      expect(strataAt(target, column, column.solidTopY)).not.toBe("air");
      expect(strataAt(target, column, column.waterTopY + 1)).toBe("air");
    });

    expect(lakes).toBeGreaterThan(0);
  }, 120000);
});

describe("lakes", () => {
  it("are present on both a 600 and an 1800 block continent", () => {
    for (const span of [600, 1800]) {
      const target = field(span);
      let land = 0;
      let lake = 0;

      forEachColumn(
        target,
        (x, z) => {
          const column = columnAt(target, x, z);
          if (!column.land) return;
          land += 1;
          if (column.lake) lake += 1;
        },
        span === 600 ? 1 : 5,
      );

      expect(land).toBeGreaterThan(0);
      expect(lake).toBeGreaterThan(0);
      // Lakes are a feature, not the terrain: they must not swallow the land.
      expect(lake / land).toBeLessThan(0.35);
    }
  }, 120000);

  it("are sealed: no lake cell touches a lower rim or open sky", () => {
    const target = field(600);
    const cache = new Map<number, number>();
    let lakeCells = 0;

    forEachColumn(target, (x, z) => {
      const column = buildColumn(target, x, z, cache);
      if (!column.lake) return;
      lakeCells += 1;

      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const neighbour = buildColumn(target, x + dx, z + dz, cache);

        // A lake may never spill into open sky off the coastline.
        expect(
          neighbour.land,
          `lake at ${x},${z} touches open sky at ${x + dx},${z + dz}`,
        ).toBe(true);

        if (neighbour.lake) {
          // Adjacent lake cells share one flat water level.
          expect(neighbour.waterTopY).toBe(column.waterTopY);
          continue;
        }

        // Any dry neighbour is a rim: its solid top must stand above the water.
        expect(
          neighbour.solidTopY,
          `lake at ${x},${z} leaks over ${x + dx},${z + dz}`,
        ).toBeGreaterThan(column.waterTopY);
      }
    });

    expect(lakeCells).toBeGreaterThan(100);
  }, 120000);

  it("never carves into or below the landmass floor", () => {
    for (const span of [600, 1800]) {
      const target = field(span);
      forEachColumn(
        target,
        (x, z) => {
          const column = columnAt(target, x, z);
          if (!column.lake) return;
          expect(column.solidTopY).toBeGreaterThan(target.baseY);
          expect(column.waterTopY).toBeLessThan(
            target.baseY + target.amplitude + target.ridgeAmplitude,
          );
        },
        span === 600 ? 1 : 3,
      );
    }
  }, 120000);

  it("stays inland, clear of the coastline", () => {
    const target = field(600);
    forEachColumn(target, (x, z) => {
      const column = columnAt(target, x, z);
      if (!column.lake) return;
      expect(column.falloff).toBeGreaterThanOrEqual(300);
    });
  }, 120000);
});

describe("both ends of the span range are sane", () => {
  it.each([600, 1800])(
    "produces a coherent %i-block continent",
    (span) => {
      const target = field(span);
      let land = 0;
      let blocks = 0;
      let tallest = 0;

      forEachColumn(target, (x, z) => {
        const column = columnAt(target, x, z);
        if (!column.land) return;
        land += 1;
        const thickness = column.solidTopY - column.bottomY + 1;
        blocks += thickness;
        if (thickness > tallest) tallest = thickness;
      });

      // The landmass fills a healthy share of its declared disc without
      // overflowing it, and it is a slab of real depth rather than a crust.
      const disc = target.radius * target.radius * 3;
      expect(land / disc).toBeGreaterThan(0.35);
      expect(land / disc).toBeLessThan(0.85);
      expect(tallest).toBeLessThanOrEqual(maxColumnHeight(target));
      expect(blocks / land).toBeGreaterThan(target.amplitude / 3);
    },
    120000,
  );
});
