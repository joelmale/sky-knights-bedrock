import {
  EntityComponentTypes,
  EntityHealthComponent,
  EntityInventoryComponent,
  EntityRideableComponent,
} from "@minecraft/server";
import { Tags, Test, register } from "@minecraft/server-gametest";

function skiffHasPilotAndPassengerSeats(test: Test): void {
  const skiff = test.spawn("skyknights:skiff", {
    x: 2,
    y: 2,
    z: 2,
  });
  const rideable = skiff.getComponent(EntityComponentTypes.Rideable) as
    EntityRideableComponent | undefined;

  test.assert(rideable !== undefined, "Skiff must be rideable.");
  test.assert(
    rideable?.seatCount === 2,
    `Expected two skiff seats; received ${String(rideable?.seatCount)}.`,
  );
  test.assert(
    rideable?.controllingSeat === 0,
    "The forward seat must control the skiff.",
  );
  test.succeed();
}

function skycutterHasSeatsAndCargo(test: Test): void {
  const skycutter = test.spawn("skyknights:skycutter", {
    x: 2,
    y: 2,
    z: 2,
  });
  const rideable = skycutter.getComponent(EntityComponentTypes.Rideable) as
    EntityRideableComponent | undefined;
  const inventory = skycutter.getComponent(EntityComponentTypes.Inventory) as
    EntityInventoryComponent | undefined;

  test.assert(rideable !== undefined, "Skycutter must be rideable.");
  test.assert(
    rideable?.seatCount === 4,
    `Expected four Skycutter seats; received ${String(rideable?.seatCount)}.`,
  );
  test.assert(
    rideable?.controllingSeat === 0,
    "The forward seat must control the Skycutter.",
  );
  test.assert(inventory !== undefined, "Skycutter must expose cargo.");
  test.assert(
    inventory?.inventorySize === 18,
    `Expected 18 cargo slots; received ${String(inventory?.inventorySize)}.`,
  );
  test.succeed();
}

function skycutterAdvancedCargoExpandsInventory(test: Test): void {
  const skycutter = test.spawn("skyknights:skycutter", {
    x: 2,
    y: 2,
    z: 2,
  });
  skycutter.triggerEvent("skyknights:apply_expanded_cargo_hold");
  const inventory = skycutter.getComponent(EntityComponentTypes.Inventory) as
    EntityInventoryComponent | undefined;

  test.assert(
    inventory?.inventorySize === 27,
    `Expected 27 expanded cargo slots; received ${String(
      inventory?.inventorySize,
    )}.`,
  );
  test.succeed();
}

function skyRaiderHasCombatHull(test: Test): void {
  const raider = test.spawn("skyknights:sky_raider", {
    x: 2,
    y: 4,
    z: 2,
  });
  const health = raider.getComponent(EntityComponentTypes.Health) as
    EntityHealthComponent | undefined;

  test.assert(health !== undefined, "Ashwing Raider must expose health.");
  test.assert(
    health?.effectiveMax === 120,
    `Expected 120 Raider hull; received ${String(health?.effectiveMax)}.`,
  );
  test.succeed();
}

register(
  "skyknights",
  "skiff_has_pilot_and_passenger_seats",
  skiffHasPilotAndPassengerSeats,
)
  .structureName("skyknights_tests:platform")
  .maxTicks(20)
  .required(true)
  .tag(Tags.suiteDefault);

register(
  "skyknights",
  "skycutter_advanced_cargo_has_27_slots",
  skycutterAdvancedCargoExpandsInventory,
)
  .structureName("skyknights_tests:platform")
  .maxTicks(20)
  .required(true)
  .tag(Tags.suiteDefault);

register("skyknights", "sky_raider_has_120_hull", skyRaiderHasCombatHull)
  .structureName("skyknights_tests:platform")
  .maxTicks(20)
  .required(true)
  .tag(Tags.suiteDefault);

register(
  "skyknights",
  "skycutter_has_four_seats_and_cargo",
  skycutterHasSeatsAndCargo,
)
  .structureName("skyknights_tests:platform")
  .maxTicks(20)
  .required(true)
  .tag(Tags.suiteDefault);
