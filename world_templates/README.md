# Stable World-Template Source

World databases are intentionally not committed here. Create a dedicated
void/empty Bedrock development world, activate the stable Sky Knights pack, and
use `npm run world-template -- --world "<world folder>"` to package a copy.

The packager validates `level.dat`, leaves the source world untouched, embeds
the compiled Behavior and Resource Packs, and writes the required world pack
references. Generated templates are ignored under `dist/`.
