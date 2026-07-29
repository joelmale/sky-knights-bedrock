# Development Environment

## Audited machine state

Checked 2026-07-25:

| Tool                            | Detected                                                    |
| ------------------------------- | ----------------------------------------------------------- |
| Git                             | 2.55.0                                                      |
| Node.js                         | 26.5.0                                                      |
| npm                             | 11.17.0                                                     |
| Visual Studio Code              | 1.129.1                                                     |
| Minecraft Bedrock               | 1.26.33 app package                                         |
| Minecraft development pack root | `%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang` |

Node 26 is newer than the current LTS line. It passed this repository's verification when the environment was created, but Node 24 LTS is the recommended baseline if a future build dependency behaves differently.

## Required components

- Minecraft Bedrock for Windows
- Node.js latest LTS
- npm
- Git
- Visual Studio Code
- `mojang-studios.minecraft-debugger`
- `blockceptionltd.blockceptionvscodeminecraftbedrockdevelopmentextension`

Optional:

- Minecraft Creator Tools at `https://mctools.dev`
- Blockbench for entity/block models and animations
- Minecraft Preview for testing upcoming API versions
- Bedrock Dedicated Server `1.26.34.3` for the opt-in GameTest smoke harness

## Version baseline

Minecraft 1.26.30 ships:

- `@minecraft/server` 2.8.0
- `@minecraft/server-ui` 2.1.0

The npm type packages, Behavior Pack dependencies, and minimum engine version must move together when this baseline changes.

The GameTest npm type package uses its build-specific version, while the
GameTest profile manifest declares the `1.0.0-beta` runtime module that BDS
`1.26.34.3` exposes.

## Local deployment

The build uses `MINECRAFT_PRODUCT="BedrockGDK"` by default. An optional `.env`
file may override that product or other documented local settings; copy
`.env.example` only when an override is needed.

Run:

```powershell
npm run local-deploy
```

Expected installed paths:

```text
%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang\development_behavior_packs\sky_knights
%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang\development_resource_packs\sky_knights
```

Do not edit deployed copies. They are build output and are replaced by the next deployment.

## One-command inspection hub

In a newly generated disposable development world, a Game Director with cheats
enabled can run:

```text
/skyknights:test_setup
```

The command waits up to 60 seconds for the three required authored islands,
then teleports the requesting player to the starter dock and prepares one
repeatable inspection hub:

- eight safely owned/restockable test-bench stalls, including the component
  blocks, oak planks, and emerald fees required by reference Skycraft orders;
- all five obstruction-safe certification berths and the
  `skyknights.skycraft_experimental` tester tag;
- Dockmaster Elian and access to all eight reference plans: Minnow, Dart,
  Cargo Punt, Cloudwhale, Aether Disc, Frostwing, Surveyor, and Grand Cruiser;
- a Skiff, fully refitted combat Skycutter, Aether Outrigger prototype, and
  Steampunk Blimp prototype at fixed starter-dock positions; and
- a reset Ashwing Raider in a separate fixed combat lane, outside the arrival
  safety radius but inside the staged Skycutter's cannon range.

The entity inspection positions are:

| Subject          | X    | Y   | Z     |
| ---------------- | ---- | --- | ----- |
| Skiff            | 24.5 | 164 | -7.5  |
| Skycutter        | 46.5 | 164 | 8.5   |
| Aether Outrigger | 5.5  | 170 | -18.5 |
| Steampunk Blimp  | 5.5  | 174 | 20.5  |
| Ashwing Raider   | 54   | 176 | 54    |

The command reports the predictable island inspection route after setup:
Starter Island `(3, 169, 1)`, Ember Outpost `(84, 169, 0)`, then Frostspire
`(253, 169, 0)`.

Reference Skycraft are not faked as extra entities. Use Dockmaster Elian to
construct and launch one through the real berth/blueprint/runtime flow, then
dismantle it before using another reference registered to that berth. This
preserves active-craft limits, material accounting, and reconstruction
behavior.

Rerunning the command restocks the bench and replaces only entities carrying
the `skyknights.dev_test_setup` ownership tag. It refuses a fleet slot
containing a block and never stamps another island. The Raider encounter is
intentionally reset. The staged Skiff and Skycutter retain per-entity owner
controls but are marked non-primary, so setup and reruns do not replace the
player's canonical recall/tutorial ship. This shortcut is for entity,
movement, rendering, and system checks; never count a setup-assisted session
as fresh progression or onboarding acceptance.

## Optional BDS/GameTest validation

The repository does not install or redistribute BDS. Download and extract the
supported server manually outside Git, then follow
[`BDS_GAME_TEST_HARNESS.md`](BDS_GAME_TEST_HARNESS.md) to configure
`SKY_KNIGHTS_BDS_ROOT`, create the test-only sentinel, and run:

```powershell
npm run test:bds:smoke
```

The command is version-gated and separate from normal CI and client hands-on
validation.

The same guarded BDS root can create and full-height scan the stable sky-only
source, then package it with the current production packs:

```powershell
npm run test:bds:void-source
npm run world-template:void
```

See [`VOID_WORLD_TEMPLATE.md`](VOID_WORLD_TEMPLATE.md). Both commands operate
only on runner-owned BDS worlds and generated repository output; they do not
inspect or modify Minecraft client saves.

## Dependency audit note

The repository-owned build commands use Node.js, TypeScript, esbuild, Prettier,
and fflate directly. This avoids the deprecated `inflight`, `glob@7`,
`rimraf@3`, and stub `@types/chokidar` packages formerly inherited through the
Mojang task runner. Both the production-only and full `npm audit` must report
zero vulnerabilities before a dependency change is accepted.

esbuild is the only approved dependency install script. Its exact approved
version is pinned in the `allowScripts` section of `package.json`; review and
update that entry deliberately when upgrading esbuild.

## Content logging

In Minecraft:

1. Open Settings.
2. Open Creator.
3. Enable Content Log File.
4. Enable Content Log GUI while actively developing.

GDK logs are under:

```text
%APPDATA%\Minecraft Bedrock\logs
```

## Debugger

The VS Code debugger listens on TCP port 19144. Run the loopback exemption once from elevated PowerShell:

```powershell
npm run enablemcloopback
```

Press F5, enter the development world, and run:

```text
/script debugger connect
```

## Troubleshooting

### Pack does not appear

- Run `npm run local-deploy` again.
- Confirm the two development pack directories exist.
- Validate both manifests and UUID dependencies.
- Restart Minecraft after manifest changes.

### Script does not load

- Check the Content Log first.
- Confirm `behavior_packs/sk_bp/manifest.json` points to `scripts/main.js`.
- Confirm `dist/scripts/main.js` was created.
- Confirm the manifest API version matches the installed game.

### Debugger does not connect

- Confirm VS Code says it is waiting for Minecraft.
- Run the loopback exemption from an elevated shell.
- Check firewall access to port 19144.
- Confirm the target module UUID matches the Behavior Pack script module.

### Type definitions disagree with the game

- Check the current Bedrock creator update notes.
- Change `package.json` and `behavior_packs/sk_bp/manifest.json` together.
- Delete `node_modules`, reinstall, and rerun verification only after reviewing the upgrade notes.
