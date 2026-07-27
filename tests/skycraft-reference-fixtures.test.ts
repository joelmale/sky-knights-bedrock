import { describe, expect, it } from "vitest";

import { skycraftBerth } from "../scripts/skycraft/berths";
import {
  REFERENCE_BLUEPRINTS,
  referenceLayout,
} from "../scripts/skycraft/catalog";
import { SKYCRAFT_CERTIFICATIONS } from "../scripts/skycraft/config";
import { evaluateAirship } from "../scripts/skycraft/engineering";
import { scanAirship } from "../scripts/skycraft/scanner";
import { AirshipBlueprint } from "../scripts/skycraft/types";

function key(position: { x: number; y: number; z: number }): string {
  return `${position.x},${position.y},${position.z}`;
}

describe("Skycraft reference fixtures", () => {
  it("passes every reference through the real scanner and certification model", () => {
    for (const reference of REFERENCE_BLUEPRINTS) {
      const berth = skycraftBerth(reference.certification).berth;
      const helmPosition = {
        x: berth.origin.x + Math.floor(berth.size.x / 2),
        y: berth.origin.y,
        z: berth.origin.z + Math.floor(berth.size.z / 2),
      };
      const blocks = new Map(
        referenceLayout(reference).map((block) => [
          key({
            x: helmPosition.x + block.x,
            y: helmPosition.y + block.y,
            z: helmPosition.z + block.z,
          }),
          { typeId: block.typeId, states: block.states },
        ]),
      );
      const certification = SKYCRAFT_CERTIFICATIONS[reference.certification];
      const scan = scanAirship(
        {
          getBlock: (position) => blocks.get(key(position)),
        },
        berth,
        helmPosition,
        reference.id,
        certification.blockCap,
      );

      expect(scan.diagnostics, reference.id).toEqual([]);
      expect(scan.helm, reference.id).toBeDefined();

      const blueprint: AirshipBlueprint = {
        schemaVersion: 1,
        airshipId: reference.id,
        revision: 1,
        berth,
        helm: scan.helm!,
        blocks: scan.blocks,
        components: scan.components,
        engineeringVersion: 1,
      };
      const report = evaluateAirship(blueprint, certification);

      expect(report.diagnostics, reference.id).toEqual([]);
      expect(report.allowed, reference.id).toBe(true);
    }
  });
});
