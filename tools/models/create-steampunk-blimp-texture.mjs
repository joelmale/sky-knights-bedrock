import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const WIDTH = 256;
const HEIGHT = 256;

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const textureOutput = path.join(
  root,
  "resource_packs",
  "sk_rp",
  "textures",
  "entity",
  "skyknights",
  "steampunk_blimp.png",
);

const palette = {
  transparent: [0, 0, 0, 0],
  canvasHighlight: [239, 220, 164, 255],
  canvasLight: [220, 199, 142, 255],
  canvas: [190, 163, 104, 255],
  canvasShadow: [139, 109, 69, 255],
  woodHighlight: [143, 84, 48, 255],
  wood: [91, 49, 29, 255],
  woodDark: [48, 27, 20, 255],
  copperHighlight: [214, 125, 78, 255],
  copper: [164, 77, 51, 255],
  copperDark: [88, 38, 29, 255],
  bronze: [159, 111, 46, 255],
  brassHighlight: [239, 201, 98, 255],
  brass: [196, 145, 52, 255],
  brassDark: [111, 73, 27, 255],
  aetherHighlight: [170, 255, 250, 255],
  aether: [48, 217, 221, 255],
  aetherDark: [20, 91, 105, 255],
  glassHighlight: [183, 229, 218, 255],
  glass: [91, 153, 158, 255],
  glassDark: [35, 75, 85, 255],
};

const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
fillRect(0, 0, WIDTH, HEIGHT, palette.transparent);

/*
 * Starter geometry UV contract (u, v, width, height):
 *
 *   0,0,112,52     balloon envelope
 *   0,52,40,16     forward envelope cap
 *   40,52,40,16    aft envelope cap
 *   0,68,96,34     upper envelope shell
 *   0,102,96,34    lower envelope shell
 *   96,0,68,44     starboard longitudinal rib
 *   96,44,68,44    port longitudinal rib
 *   112,88,24,20   vertical tail fins
 *   136,88,40,12   horizontal tail fins
 *   0,136,72,26    gondola hull/deck
 *   0,162,28,6     gondola end walls
 *   72,136,52,24   gondola cabin
 *   48,160,60,20   gondola roof
 *   164,0,32,16    engine housings
 *   164,16,8,6     engine exhaust stacks
 *   196,0,8,4      propeller hubs
 *   196,4,6,17     vertical propeller blades
 *   202,4,34,3     horizontal propeller blades
 *   0,224,256,32   reusable material swatches
 */

paintCanvas(0, 0, 112, 52, true);
paintCanvas(0, 52, 40, 16, false);
paintCanvas(40, 52, 40, 16, false);
paintCanvas(0, 68, 96, 34, true);
paintCanvas(0, 102, 96, 34, true);

paintRib(96, 0, 68, 44);
paintRib(96, 44, 68, 44);

paintTailFin(112, 88, 24, 20);
paintTailFin(136, 88, 40, 12);

paintHull(0, 136, 72, 26);
paintHull(0, 162, 28, 6);
paintCabin(72, 136, 52, 24);
paintRoof(48, 160, 60, 20);

paintEngine(164, 0, 32, 16);
paintCopper(164, 16, 8, 6);
paintPropeller(196, 0, 8, 4);
paintPropeller(196, 4, 6, 17);
paintPropeller(202, 4, 34, 3);

paintMaterialSwatches();

await mkdir(path.dirname(textureOutput), { recursive: true });
await writeFile(textureOutput, encodePng(pixels, WIDTH, HEIGHT));

process.stdout.write(`Created steampunk blimp texture: ${textureOutput}\n`);

function paintCanvas(x, y, width, height, includeRibs) {
  fillRect(x, y, width, height, palette.canvas);
  for (let py = y; py < y + height; py += 4) {
    for (let px = x; px < x + width; px += 4) {
      const checker = ((px - x) / 4 + (py - y) / 4) % 3;
      const color =
        checker === 0
          ? palette.canvasLight
          : checker === 1
            ? palette.canvas
            : palette.canvasShadow;
      fillRect(px, py, Math.min(4, x + width - px), 1, color);
    }
  }
  strokeRect(x, y, width, height, palette.canvasShadow);
  if (width >= 16 && height >= 8) {
    const seamY = y + Math.floor(height / 2);
    horizontalLine(x + 1, x + width - 2, seamY, palette.canvasShadow);
    for (let stitchX = x + 3; stitchX < x + width - 2; stitchX += 4) {
      setPixel(stitchX, seamY, palette.canvasLight);
    }
  }
  if (includeRibs && width >= 48) {
    for (let ribX = x + 2; ribX < x + width; ribX += 27) {
      fillRect(ribX, y, 2, height, palette.woodDark);
      verticalLine(ribX + 2, y, y + height - 1, palette.copper);
    }
  }
  addCanvasPatches(x, y, width, height);
}

function addCanvasPatches(x, y, width, height) {
  const patches = [
    [7, 6],
    [31, 14],
    [55, 5],
    [79, 23],
    [18, 32],
    [67, 39],
  ];
  for (const [offsetX, offsetY] of patches) {
    if (offsetX + 3 >= width || offsetY + 2 >= height) continue;
    fillRect(x + offsetX, y + offsetY, 3, 2, palette.canvasHighlight);
    setPixel(x + offsetX, y + offsetY + 1, palette.canvasShadow);
  }
}

function paintRib(x, y, width, height) {
  fillRect(x, y, width, height, palette.woodDark);
  for (let py = y + 2; py < y + height - 1; py += 7) {
    fillRect(x + 1, py, width - 2, 3, palette.wood);
    horizontalLine(x + 2, x + width - 3, py, palette.woodHighlight);
    horizontalLine(x + 2, x + width - 3, py + 2, palette.copperDark);
  }
  for (let px = x + 5; px < x + width; px += 15) {
    fillRect(px, y, 3, height, palette.copper);
    verticalLine(px, y, y + height - 1, palette.copperHighlight);
    verticalLine(px + 2, y, y + height - 1, palette.copperDark);
  }
  strokeRect(x, y, width, height, palette.copperDark);
}

function paintTailFin(x, y, width, height) {
  fillRect(x, y, width, height, palette.canvas);
  strokeRect(x, y, width, height, palette.woodDark);
  strokeRect(x + 2, y + 2, width - 4, height - 4, palette.copper);
  for (let px = x + 4; px < x + width - 2; px += 8) {
    verticalLine(px, y + 3, y + height - 4, palette.canvasLight);
  }
}

function paintHull(x, y, width, height) {
  fillRect(x, y, width, height, palette.wood);
  for (let py = y + 2; py < y + height; py += 5) {
    horizontalLine(x, x + width - 1, py, palette.woodDark);
    horizontalLine(x + 1, x + width - 2, py + 1, palette.woodHighlight);
  }
  for (let px = x + 9; px < x + width; px += 17) {
    verticalLine(px, y + 1, y + height - 2, palette.copperDark);
  }
  strokeRect(x, y, width, height, palette.woodDark);
  if (height >= 10) {
    fillRect(x + 3, y + 3, Math.max(1, width - 6), 3, palette.copper);
    horizontalLine(x + 4, x + width - 5, y + 3, palette.copperHighlight);
  }
}

function paintCabin(x, y, width, height) {
  paintHull(x, y, width, height);
  const windowWidth = 8;
  for (let px = x + 5; px + windowWidth < x + width; px += 13) {
    fillRect(px, y + 7, windowWidth, 9, palette.copperDark);
    fillRect(px + 1, y + 8, windowWidth - 2, 7, palette.glassDark);
    fillRect(px + 2, y + 9, windowWidth - 4, 5, palette.glass);
    setPixel(px + 2, y + 9, palette.glassHighlight);
    setPixel(px + 3, y + 9, palette.glassHighlight);
  }
}

function paintRoof(x, y, width, height) {
  fillRect(x, y, width, height, palette.woodDark);
  for (let py = y + 2; py < y + height; py += 4) {
    horizontalLine(x + 1, x + width - 2, py, palette.woodHighlight);
    horizontalLine(x + 1, x + width - 2, py + 1, palette.wood);
  }
  for (let px = x + 7; px < x + width; px += 16) {
    fillRect(px, y, 2, height, palette.copper);
  }
  strokeRect(x, y, width, height, palette.copperDark);
}

function paintEngine(x, y, width, height) {
  fillRect(x, y, width, height, palette.copperDark);
  strokeRect(x, y, width, height, palette.woodDark);
  for (let px = x + 3; px < x + width - 2; px += 10) {
    fillRect(px, y + 2, 6, height - 4, palette.copper);
    verticalLine(px, y + 3, y + height - 4, palette.copperHighlight);
    verticalLine(px + 5, y + 3, y + height - 4, palette.copperDark);
  }
  const coreWidth = Math.min(10, width - 6);
  const coreX = x + Math.floor((width - coreWidth) / 2);
  const coreY = y + Math.max(2, Math.floor((height - 8) / 2));
  fillRect(
    coreX,
    coreY,
    coreWidth,
    Math.min(8, height - 4),
    palette.aetherDark,
  );
  fillRect(
    coreX + 2,
    coreY + 2,
    Math.max(1, coreWidth - 4),
    Math.max(1, Math.min(4, height - 8)),
    palette.aether,
  );
  setPixel(coreX + 2, coreY + 2, palette.aetherHighlight);
}

function paintCopper(x, y, width, height) {
  fillRect(x, y, width, height, palette.copper);
  strokeRect(x, y, width, height, palette.copperDark);
  if (width > 3 && height > 3) {
    horizontalLine(x + 1, x + width - 2, y + 1, palette.copperHighlight);
  }
}

function paintPropeller(x, y, width, height) {
  fillRect(x, y, width, height, palette.brass);
  strokeRect(x, y, width, height, palette.brassDark);
  if (width > 2 && height > 2) {
    horizontalLine(x + 1, x + width - 2, y + 1, palette.brassHighlight);
  }
}

function paintMaterialSwatches() {
  const swatches = [
    palette.canvas,
    palette.canvasLight,
    palette.wood,
    palette.woodDark,
    palette.copper,
    palette.copperDark,
    palette.brass,
    palette.aether,
  ];
  for (let index = 0; index < swatches.length; index += 1) {
    const x = index * 32;
    fillRect(x, 224, 32, 32, swatches[index]);
    strokeRect(x, 224, 32, 32, palette.woodDark);
    if (index === 7) {
      fillRect(x + 8, 232, 16, 16, palette.aetherDark);
      fillRect(x + 11, 235, 10, 10, palette.aether);
      fillRect(x + 12, 236, 3, 3, palette.aetherHighlight);
    }
  }
}

function fillRect(x, y, width, height, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      setPixel(px, py, color);
    }
  }
}

function strokeRect(x, y, width, height, color) {
  if (width <= 0 || height <= 0) return;
  horizontalLine(x, x + width - 1, y, color);
  horizontalLine(x, x + width - 1, y + height - 1, color);
  verticalLine(x, y, y + height - 1, color);
  verticalLine(x + width - 1, y, y + height - 1, color);
}

function horizontalLine(x1, x2, y, color) {
  for (let x = x1; x <= x2; x += 1) {
    setPixel(x, y, color);
  }
}

function verticalLine(x, y1, y2, color) {
  for (let y = y1; y <= y2; y += 1) {
    setPixel(x, y, color);
  }
}

function setPixel(x, y, color) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const offset = (y * WIDTH + x) * 4;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = color[3];
}

function encodePng(rgba, width, height) {
  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const outputOffset = y * (stride + 1);
    scanlines[outputOffset] = 0;
    rgba.copy(scanlines, outputOffset + 1, y * stride, (y + 1) * stride);
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  return Buffer.concat([
    signature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(
    crc32(Buffer.concat([typeBuffer, data])),
    8 + data.length,
  );
  return chunk;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
