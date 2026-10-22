import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { simplifyClosed, traceContours } from '../src/core/image/contours';
import { buildMask, maskCoverage, removeSolidBackground, resolveSource } from '../src/core/image/preprocess';
import { createMask, type Raster } from '../src/core/image/raster';
import { coverWithRects, sampleGrid } from '../src/core/image/rects';
import { DEFAULT_TRACE, traceArtwork } from '../src/core/image/trace';

const fixture = (name: string): Raster => {
  const buf = fs.readFileSync(path.join(__dirname, 'fixtures', name));
  if (name.endsWith('.png')) {
    const png = PNG.sync.read(buf);
    return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
  }
  const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
};

const maskAt = (m: { width: number; data: Uint8Array }, x: number, y: number) => m.data[y * m.width + x];

describe('rectangle cover', () => {
  it('covers exactly the filled cells without overlap', () => {
    const m = createMask(40, 30);
    let seed = 3;
    for (let i = 0; i < m.data.length; i++) m.data[i] = (seed = (seed * 48271) % 2147483647) % 3 === 0 ? 1 : 0;
    const grid = sampleGrid(m, 40);
    const rects = coverWithRects(grid);
    const hit = new Uint8Array(grid.cols * grid.rows);
    for (const r of rects) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) hit[y * grid.cols + x]++;
    for (let i = 0; i < hit.length; i++) expect(hit[i]).toBe(grid.data[i]);
  });

  it('a solid block is a single rectangle', () => {
    const m = createMask(20, 20);
    for (let y = 5; y < 15; y++) for (let x = 2; x < 18; x++) m.data[y * 20 + x] = 1;
    expect(coverWithRects(sampleGrid(m, 20))).toHaveLength(1);
  });
});

describe('contours', () => {
  it('a filled square gives one closed outline that simplifies to 4 corners', () => {
    const m = createMask(20, 20);
    for (let y = 4; y < 16; y++) for (let x = 4; x < 16; x++) m.data[y * 20 + x] = 1;
    const c = traceContours(m);
    expect(c).toHaveLength(1);
    expect(c[0].closed).toBe(true);
    expect(simplifyClosed(c[0].points, 0.6).length).toBeLessThanOrEqual(8);
  });

  it('a ring gives an outer and an inner outline', () => {
    const m = createMask(40, 40);
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
      const d = Math.hypot(x - 19.5, y - 19.5);
      m.data[y * 40 + x] = d > 8 && d < 15 ? 1 : 0;
    }
    const c = traceContours(m);
    expect(c.filter((p) => p.closed)).toHaveLength(2);
  });
});

describe('PNG with a transparent background', () => {
  const img = fixture('emblem_transparent.png');

  it('auto mode uses the alpha channel', () => {
    expect(resolveSource(img, 'auto')).toBe('alpha');
  });

  it('fill + outline produce bounded geometry', () => {
    const geo = traceArtwork(img, { ...DEFAULT_TRACE, mode: 'both' });
    expect(geo.quads.length).toBeGreaterThan(20);
    expect(geo.quads.length).toBeLessThan(1500);
    // ring outer + ring inner + star
    expect(geo.segments.length).toBeGreaterThan(30);
    for (const q of geo.quads) for (const [x, y] of q) expect(Math.abs(x) <= 0.5 && Math.abs(y) <= 0.5).toBe(true);
    // centre of the star is ink, the gap between star and ring is not
    const m = geo.mask;
    expect(maskAt(m, Math.round(m.width / 2), Math.round(m.height / 2))).toBe(1);
    expect(maskAt(m, Math.round(m.width / 2), Math.round(m.height * 0.13))).toBe(0);
  });

  it('three closed outlines: ring outer, ring inner, star', () => {
    const geo = traceArtwork(img, { ...DEFAULT_TRACE, mode: 'outline' });
    const contours = traceContours(geo.mask).filter((c) => c.closed && c.points.length > 20);
    expect(contours).toHaveLength(3);
  });
});

describe('JPG with a plain white background', () => {
  const img = fixture('shield_white_bg.jpg');

  it('auto mode picks dark ink on light background', () => {
    expect(resolveSource(img, 'auto')).toBe('dark');
  });

  it('background removal clears the border but keeps enclosed white areas', () => {
    const cut = removeSolidBackground(img, 40);
    expect(cut.data[3]).toBe(0); // corner
    const i = (105 * img.width + 150) * 4; // red disk in the middle
    expect(cut.data[i + 3]).toBe(255);
    const j = (70 * img.width + 150) * 4; // white vertical bar inside the shield
    expect(cut.data[j + 3]).toBe(255);
  });

  it('mask keeps the white cross as a hole and the red disk as ink', () => {
    const geo = traceArtwork(img, { ...DEFAULT_TRACE, workSize: 300 });
    const m = geo.mask;
    expect(maskAt(m, 150, 160)).toBe(0); // white vertical bar (below the disk)
    expect(maskAt(m, 150, 105)).toBe(1); // red disk
    expect(maskAt(m, 100, 70)).toBe(1); // shield body
    expect(maskAt(m, 5, 5)).toBe(0); // background
    expect(maskCoverage(m)).toBeGreaterThan(0.2);
    expect(maskCoverage(m)).toBeLessThan(0.6);
  });
});

describe('complex image (noisy photo-like scene)', () => {
  const img = fixture('complex_scene.jpg');

  it.each(['dark', 'edges', 'auto'] as const)('source=%s stays within element limits', (source) => {
    const geo = traceArtwork(img, { ...DEFAULT_TRACE, source, threshold: source === 'edges' ? 60 : 70, mode: 'both' });
    expect(geo.quads.length + geo.segments.length).toBeLessThan(6000);
    for (const s of geo.segments) for (const p of s) expect(Number.isFinite(p[0]) && Number.isFinite(p[1])).toBe(true);
  });

  it('the dark tank silhouette is detected', () => {
    const geo = traceArtwork(img, { ...DEFAULT_TRACE, source: 'dark', threshold: 60, removeBackground: false, workSize: 400 });
    expect(maskAt(geo.mask, 200, 200)).toBe(1);
    expect(maskAt(geo.mask, 200, 40)).toBe(0);
  });

  it('despeckle removes small blobs', () => {
    const raw = buildMask(img, { source: 'dark', threshold: 60, alphaThreshold: 128, invert: false, minSpeck: 0 });
    const clean = buildMask(img, { source: 'dark', threshold: 60, alphaThreshold: 128, invert: false, minSpeck: 40 });
    expect(maskCoverage(clean)).toBeLessThanOrEqual(maskCoverage(raw));
  });
});
