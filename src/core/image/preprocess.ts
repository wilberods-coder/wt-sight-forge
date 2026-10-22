import { cloneRaster, createMask, luminance, type Mask, type Raster } from './raster';

/** Share of pixels that are noticeably transparent. */
export function transparencyRatio(img: Raster): number {
  let n = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 200) n++;
  return n / (img.width * img.height);
}

/**
 * Estimate the background colour from the image border: the most common
 * (coarsely quantised) opaque border colour.
 */
export function estimateBorderColor(img: Raster): [number, number, number] | null {
  const { width: w, height: h, data } = img;
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const visit = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 128) return;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += data[i];
    e.g += data[i + 1];
    e.b += data[i + 2];
    buckets.set(key, e);
  };
  for (let x = 0; x < w; x++) {
    visit(x, 0);
    visit(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    visit(0, y);
    visit(w - 1, y);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const e of buckets.values()) if (!best || e.n > best.n) best = e;
  if (!best) return null;
  return [best.r / best.n, best.g / best.n, best.b / best.n];
}

/**
 * Remove a solid background: flood fill from the image border through pixels whose colour
 * is within `tolerance` (0..255, Euclidean RGB distance) of the border colour.
 * Enclosed areas of the same colour (e.g. the inside of a letter "O") stay intact.
 */
export function removeSolidBackground(img: Raster, tolerance: number): Raster {
  const bg = estimateBorderColor(img);
  const out = cloneRaster(img);
  if (!bg) return out;
  const { width: w, height: h } = img;
  const d = out.data;
  const tol2 = tolerance * tolerance * 3;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const close = (p: number) => {
    const i = p * 4;
    if (d[i + 3] < 128) return true; // already transparent counts as background
    const dr = d[i] - bg[0], dg = d[i + 1] - bg[1], db = d[i + 2] - bg[2];
    return dr * dr + dg * dg + db * db <= tol2;
  };
  const push = (p: number) => {
    if (!seen[p] && close(p)) {
      seen[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    d[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }
  return out;
}

export type MaskSource = 'auto' | 'alpha' | 'dark' | 'light' | 'edges';

export interface MaskOptions {
  source: MaskSource;
  /** Brightness threshold 0..255 for "dark"/"light"; gradient threshold for "edges". */
  threshold: number;
  /** Pixels with alpha below this are always empty. */
  alphaThreshold: number;
  invert: boolean;
  /** Remove isolated specks smaller than this many pixels. */
  minSpeck: number;
}

/**
 * "auto": images with real transparency use the alpha channel; opaque images take dark ink
 * on a light background, or light ink on a dark background.
 */
export function resolveSource(img: Raster, source: MaskSource): Exclude<MaskSource, 'auto'> {
  if (source !== 'auto') return source;
  if (transparencyRatio(img) > 0.02) return 'alpha';
  const bg = estimateBorderColor(img);
  return bg && luminance(bg[0], bg[1], bg[2]) < 110 ? 'light' : 'dark';
}

function sobel(img: Raster): Float32Array {
  const { width: w, height: h, data } = img;
  const lum = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const a = data[p * 4 + 3] / 255;
    // Composite over black so alpha edges count as edges too.
    lum[p] = luminance(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]) * a;
  }
  const g = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const gx = -lum[p - w - 1] - 2 * lum[p - 1] - lum[p + w - 1] + lum[p - w + 1] + 2 * lum[p + 1] + lum[p + w + 1];
      const gy = -lum[p - w - 1] - 2 * lum[p - w] - lum[p - w + 1] + lum[p + w - 1] + 2 * lum[p + w] + lum[p + w + 1];
      g[p] = Math.sqrt(gx * gx + gy * gy) / 4;
    }
  return g;
}

/** Turn an image into a binary ink mask. */
export function buildMask(img: Raster, opts: MaskOptions): Mask {
  const { width: w, height: h, data } = img;
  const mask = createMask(w, h);
  const source = resolveSource(img, opts.source);
  const grad = source === 'edges' ? sobel(img) : null;
  for (let p = 0; p < w * h; p++) {
    const a = data[p * 4 + 3];
    let on: boolean;
    if (source === 'edges') on = grad![p] >= opts.threshold;
    else if (a < opts.alphaThreshold) on = false;
    else if (source === 'alpha') on = true;
    else {
      const l = luminance(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
      on = source === 'dark' ? l < opts.threshold : l > opts.threshold;
    }
    if (opts.invert && (source === 'edges' || a >= opts.alphaThreshold)) on = !on;
    mask.data[p] = on ? 1 : 0;
  }
  if (opts.minSpeck > 0) removeSpecks(mask, opts.minSpeck);
  return mask;
}

/** Remove 4-connected components smaller than `minSize` pixels (both ink and holes). */
export function removeSpecks(mask: Mask, minSize: number): void {
  const { width: w, height: h, data } = mask;
  const label = new Int32Array(w * h).fill(-1);
  const stack: number[] = [];
  const comp: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (label[start] !== -1) continue;
    const v = data[start];
    comp.length = 0;
    stack.push(start);
    label[start] = start;
    let touchesBorder = false;
    while (stack.length) {
      const p = stack.pop()!;
      comp.push(p);
      const x = p % w;
      const y = (p - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb)
        if (q >= 0 && label[q] === -1 && data[q] === v) {
          label[q] = start;
          stack.push(q);
        }
    }
    // Small ink specks are removed; small holes inside ink are filled (but never the outer background).
    if (comp.length < minSize && (v === 1 || !touchesBorder)) for (const p of comp) data[p] = v ? 0 : 1;
  }
}

export function maskCoverage(mask: Mask): number {
  let n = 0;
  for (let i = 0; i < mask.data.length; i++) n += mask.data[i];
  return n / mask.data.length;
}
