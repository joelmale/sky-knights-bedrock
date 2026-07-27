import { SkycraftMilestone } from "./progression";
import { DynamicPropertyHost } from "./runtime/repository";

const MILESTONE_KEY = "skyknights:skycraft_milestones_v1";
const ALL_MILESTONES: ReadonlySet<SkycraftMilestone> = new Set([
  "starter:resources_ready",
  "discovery:ember_outpost",
  "unlock:skycutter_blueprint",
  "discovery:sunspire_reach",
  "discovery:verdant_hollow",
  "discovery:frostspire",
  "objective:combat_complete",
  "material:gold_copper",
  "material:froststeel",
  "material:relic_shards_2",
  "material:aether_core",
]);

interface MilestonesV1 {
  schemaVersion: 1;
  values: readonly SkycraftMilestone[];
}

function parse(value: string | undefined): MilestonesV1 {
  if (value === undefined) {
    return { schemaVersion: 1, values: ["starter:resources_ready"] };
  }

  try {
    const parsed = JSON.parse(value) as Partial<MilestonesV1>;
    if (
      parsed.schemaVersion !== 1 ||
      !Array.isArray(parsed.values) ||
      !parsed.values.every(
        (entry) =>
          typeof entry === "string" &&
          ALL_MILESTONES.has(entry as SkycraftMilestone),
      )
    ) {
      throw new Error("unsupported schema");
    }
    return {
      schemaVersion: 1,
      values: [...new Set(parsed.values)].sort(),
    };
  } catch {
    throw new Error("Skycraft milestone state is corrupt.");
  }
}

export class SkycraftMilestoneRepository {
  public constructor(private readonly host: DynamicPropertyHost) {}

  public load(): ReadonlySet<SkycraftMilestone> {
    return new Set(parse(this.host.getDynamicProperty(MILESTONE_KEY)).values);
  }

  public record(
    values: ReadonlySet<SkycraftMilestone>,
  ): ReadonlySet<SkycraftMilestone> {
    const merged = new Set(this.load());
    for (const value of values) {
      if (!ALL_MILESTONES.has(value)) {
        throw new Error(`Unknown Skycraft milestone ${value}.`);
      }
      merged.add(value);
    }
    const sorted = [...merged].sort();
    this.host.setDynamicProperty(
      MILESTONE_KEY,
      JSON.stringify({ schemaVersion: 1, values: sorted }),
    );
    return new Set(sorted);
  }
}
