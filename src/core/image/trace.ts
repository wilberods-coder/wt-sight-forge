import { polylineLength, simplifyClosed, traceContours, type Pt } from './contours';
import { buildMask, removeSolidBackground, resolveSource, type MaskOptions } from './preprocess';
import { downscale, type Mask, type Raster } from './raster';
import { applyRowHatch, coverWithRects, sampleGrid, type Rect } from './rects';

export type TraceMode = 'fill' | 'outline' | 'both';

export interface TraceOptions extends MaskOptions {
  /** Max side of the working raster. */
  workSize: number;
  removeBackground: boolean;
  bgTolerance: number;
  mode: TraceMode;
  /** Fill resolution: grid cells along the longest side. */
  fillDetail: number;
  /** Outline simplification tolerance, in working-raster pixels. */
  simplify: number;
  /** Outlines shorter than this (working pixels) are dropped. */
  minContour: number;
  /** 0..1, emulated with a row hatch in fill mode. */
  opacity: number;
}

/** Geometry in normalised artwork space: the longest side spans -0.5..0.5, centre at 0, y down. */
export interface ArtGeometry {
  quads: [Pt, Pt, Pt, Pt][];
  segments: [Pt, Pt][];
  aspect: number; // width / height
  mask: Mask;
  resolvedSource: string;
}

export const DEFAULT_TRACE: TraceOptions = {
  source: 'auto',
  threshold: 128,
  alphaThreshold: 128,
  invert: false,
  minSpeck: 6,
  workSize: 384,
  removeBackground: true,
  bgTolerance: 40,
  mode: 'fill',
  fillDetail: 72,
  simplify: 1.2,
  minContour: 8,
  opacity: 1,
};

export function traceArtwork(input: Raster, opts: TraceOptions): ArtGeometry {
  let img = downscale(input, opts.workSize);
  // Decide on the original pixels, before the background is cut out.
  const source = resolveSource(img, opts.source);
  if (opts.removeBackground) img = removeSolidBackground(img, opts.bgTolerance);
  const mask = buildMask(img, { ...opts, source });

  const side = Math.max(mask.width, mask.height);
  const norm = (x: number, y: number): Pt => [(x - mask.width / 2) / side, (y - mask.height / 2) / side];

  const quads: [Pt, Pt, Pt, Pt][] = [];
  if (opts.mode !== 'outline') {
    const grid = sampleGrid(mask, opts.fillDetail);
    applyRowHatch(grid, opts.opacity);
    const rects: Rect[] = coverWithRects(grid);
    for (const r of rects) {
      const x0 = Math.min(mask.width, r.x * grid.cell);
      const y0 = Math.min(mask.height, r.y * grid.cell);
      const x1 = Math.min(mask.width, (r.x + r.w) * grid.cell);
      const y1 = Math.min(mask.height, (r.y + r.h) * grid.cell);
      quads.push([norm(x0, y0), norm(x1, y0), norm(x1, y1), norm(x0, y1)]);
    }
  }

  const segments: [Pt, Pt][] = [];
  if (opts.mode !== 'fill') {
    for (const c of traceContours(mask)) {
      if (polylineLength(c) < opts.minContour) continue;
      const pts = c.closed ? simplifyClosed(c.points, opts.simplify) : c.points;
      if (pts.length < 2) continue;
      const n = c.closed ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        segments.push([norm(a[0], a[1]), norm(b[0], b[1])]);
      }
    }
  }

  return { quads, segments, aspect: mask.width / mask.height, mask, resolvedSource: source };
}
