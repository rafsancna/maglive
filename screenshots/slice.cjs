/* Slice tall full-page screenshots into readable segments for design review.
   Usage: node screenshots/slice.cjs <srcPng> <outDir> [segmentHeight] */
const sharp = require("sharp");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const [src, outDir, segRaw] = process.argv.slice(2);
  if (!src || !outDir) throw new Error("src and outDir required");
  const segment = Number(segRaw || 1100);
  const width = Number(process.env.SLICE_WIDTH || 980);
  fs.mkdirSync(outDir, { recursive: true });
  const image = sharp(src);
  const meta = await image.metadata();
  const total = meta.height;
  let index = 0;
  for (let top = 0; top < total; top += segment) {
    const height = Math.min(segment, total - top);
    const name = `${path.basename(src, ".png")}-${String(index).padStart(2, "0")}.jpg`;
    await sharp(src)
      .extract({ left: 0, top, width: meta.width, height })
      .resize({ width: Math.min(width, meta.width * 2) })
      .jpeg({ quality: 74 })
      .toFile(path.join(outDir, name));
    index += 1;
  }
  console.log(`wrote ${index} segments to ${outDir}`);
})();
