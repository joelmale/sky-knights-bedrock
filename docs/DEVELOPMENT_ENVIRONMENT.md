# Development Environment

## Audited machine state

Checked 2026-07-25:

| Tool | Detected |
|---|---|
| Git | 2.55.0 |
| Node.js | 26.5.0 |
| npm | 11.17.0 |
| Visual Studio Code | 1.129.1 |
| Minecraft Bedrock | 1.26.33 app package |
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
- Bedrock Dedicated Server for later multiplayer automation

## Version baseline

Minecraft 1.26.30 ships:

- `@minecraft/server` 2.8.0
- `@minecraft/server-ui` 2.1.0

The npm type packages, Behavior Pack dependencies, and minimum engine version must move together when this baseline changes.

## Local deployment

The build uses `MINECRAFT_PRODUCT="BedrockGDK"` from `.env`.

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
