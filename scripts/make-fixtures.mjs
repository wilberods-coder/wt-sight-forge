// Generates the test images used by the unit tests and the "Try a sample" buttons.
// Run: node scripts/make-fixtures.mjs
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDirs = [path.join(root, 'tests/fixtures'), path.join(root, 'public/samples')];
outDirs.forEach((d) => fs.mkdirSync(d, { recursive: true }));

function canvas(w, h, bg = [0, 0, 0, 0]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(bg, i * 4);
  return { w, h, data };
}

/** Rasterise a shape given as inside(x, y) with 4x4 supersampling and alpha blending. */
function fill(c, inside, color) {
  const ss = 4;
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      let n = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) if (inside(x + (sx + 0.5) / ss, y + (sy + 0.5) / ss)) n++;
      if (!n) continue;
      const a = (n / (ss * ss)) * (color[3] / 255);
      const i = (y * c.w + x) * 4;
      const da = c.data[i + 3] / 255;
      const oa = a + da * (1 - a);
      for (let k = 0; k < 3; k++) c.data[i + k] = oa ? (color[k] * a + c.data[i + k] * da * (1 - a)) / oa : 0;
      c.data[i + 3] = oa * 255;
    }
}

function inPoly(pts) {
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}
const star = (cx, cy, r1, r2, n = 5, rot = -Math.PI / 2) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? r2 : r1;
    const a = rot + (i * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
const ring = (cx, cy, r0, r1) => (x, y) => {
  const d = Math.hypot(x - cx, y - cy);
  return d >= r0 && d <= r1;
};
const disk = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) <= r;

function savePng(c, name) {
  const png = new PNG({ width: c.w, height: c.h });
  png.data = Buffer.from(c.data);
  const buf = PNG.sync.write(png);
  outDirs.forEach((d) => fs.writeFileSync(path.join(d, name), buf));
}
function saveJpg(c, name, quality) {
  const raw = { width: c.w, height: c.h, data: Buffer.from(c.data) };
  const buf = jpeg.encode(raw, quality).data;
  outDirs.forEach((d) => fs.writeFileSync(path.join(d, name), buf));
}

// 1. Emblem with transparent background: ring + star.
{
  const c = canvas(256, 256);
  fill(c, ring(128, 128, 96, 116), [255, 255, 255, 255]);
  fill(c, inPoly(star(128, 132, 84, 34)), [255, 255, 255, 255]);
  savePng(c, 'emblem_transparent.png');
}

// 2. Shield on a plain white background, saved as JPEG (compression artefacts on purpose).
{
  const c = canvas(300, 240, [255, 255, 255, 255]);
  const shield = [[150, 20], [250, 50], [240, 140], [150, 220], [60, 140], [50, 50]];
  fill(c, inPoly(shield), [30, 30, 30, 255]);
  fill(c, inPoly([[140, 50], [160, 50], [160, 190], [140, 190]]), [255, 255, 255, 255]);
  fill(c, inPoly([[80, 95], [220, 95], [220, 115], [80, 115]]), [255, 255, 255, 255]);
  fill(c, disk(150, 105, 22), [200, 40, 40, 255]);
  saveJpg(c, 'shield_white_bg.jpg', 75);
}

// 3. "Complex" image: gradient sky, noisy ground, tank silhouette, scattered blobs.
{
  const w = 400, h = 260;
  const c = canvas(w, h, [0, 0, 0, 255]);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const sky = y < 150;
      const n = (rnd() - 0.5) * (sky ? 20 : 70);
      c.data[i] = (sky ? 120 + y * 0.6 : 90) + n;
      c.data[i + 1] = (sky ? 160 + y * 0.4 : 110) + n;
      c.data[i + 2] = (sky ? 210 : 60) + n;
      c.data[i + 3] = 255;
    }
  fill(c, inPoly([[90, 170], [310, 170], [330, 200], [300, 225], [100, 225], [70, 200]]), [25, 28, 22, 255]);
  fill(c, inPoly([[150, 130], [250, 130], [265, 170], [140, 170]]), [25, 28, 22, 255]);
  fill(c, inPoly([[240, 140], [380, 132], [380, 142], [240, 152]]), [25, 28, 22, 255]);
  for (let k = 0; k < 25; k++) fill(c, disk(rnd() * w, 60 + rnd() * 80, 2 + rnd() * 6), [40 + rnd() * 60, 60, 50, 255]);
  saveJpg(c, 'complex_scene.jpg', 85);
}

console.log('fixtures written to', outDirs.join(', '));
