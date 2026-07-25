# Sky Knights: Bedrock

Minecraft Bedrock add-on implementing the floating-island exploration, progression, combat, and airship fantasy of Sky Knights.

The repository is based on Microsoft/Mojang's TypeScript starter, updated for Minecraft Bedrock 1.26.30+ and the stable Script API shipped with that release.

## Prerequisites

- Windows 10 or 11
- Minecraft Bedrock for Windows
- Git
- Node.js 24 LTS recommended; Node.js 20 or newer supported by this project
- Visual Studio Code
- Minecraft Bedrock Debugger VS Code extension
- Blockception's Minecraft Bedrock Development VS Code extension

Minecraft Creator Tools (`mctools.dev` or its CLI) is optional. The build does not require it.

## First setup

```powershell
git clone <future-remote-url>
cd sky-knights-bedrock
npm install
npm run check
npm run local-deploy
```

`local-deploy` builds the TypeScript and copies the Behavior and Resource Packs to the development pack folders for the Minecraft product selected in `.env`. Leave it running to rebuild on file changes.

This machine uses the GDK Bedrock location:

```text
%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang\
```

The deploy task creates and uses:

```text
development_behavior_packs\sky_knights
development_resource_packs\sky_knights
```

## Load the pack in Minecraft

1. Run `npm run local-deploy`.
2. Start Minecraft Bedrock.
3. Create a test world with cheats enabled.
4. Open Behavior Packs → My Packs.
5. Activate **Sky Knights Behavior Pack**. Its Resource Pack dependency should activate with it.
6. Enter the world.
7. Confirm the message `Sky Knights development pack is active.`

In Minecraft, enable **Content Log File** and **Content Log GUI** under Settings → Creator. Use `/reload` after compatible content changes; restart the world when manifests or some entity definitions change.

## Debug TypeScript

One-time setup from an elevated PowerShell:

```powershell
npm run enablemcloopback
```

Then:

1. Run the `deploy` task or `npm run local-deploy`.
2. Press F5 in VS Code and select **Debug Sky Knights in Minecraft**.
3. Enter the test world.
4. Run `/script debugger connect`.
5. Set breakpoints in `scripts/**/*.ts`.

The debugger listens on port `19144` and uses the source maps under `dist/debug`.

## Commands

```text
npm run build                 Type-check and bundle scripts
npm run lint                  Lint TypeScript
npm test                      Run host-side unit tests
npm run check                 Lint, build, and test
npm run local-deploy          Build/deploy and watch for changes
npm run mcaddon               Build an importable development .mcaddon
npm run mcaddon:production    Build a production .mcaddon
npm run verify                Run all checks and package production output
```

Packaged output is written to:

```text
dist/packages/sky_knights.mcaddon
```

## Project layout

```text
behavior_packs/sk_bp/   Server-side pack data and compiled script target
resource_packs/sk_rp/   Client assets, text, geometry, animation, and sound
scripts/                TypeScript source
tests/                  Host-side unit tests for deterministic/pure logic
docs/                   Decisions and environment notes
```

See [BEDROCK_ADDON_ROADMAP.md](BEDROCK_ADDON_ROADMAP.md) for the full implementation plan.

## API policy

- Stable APIs are the default.
- Exact Minecraft module versions are pinned in `package.json` and the Behavior Pack manifest.
- Beta APIs require an explicit build profile and an architecture decision.
- Shipped identifiers use the `skyknights` namespace and are never reused for a different concept.

No redistribution license has been selected yet. Treat the repository as private until one is added.
