import type { Mask } from './raster';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GridSample {
  cols: number;
  rows: number;
  /** Size of one grid cell in mask pixels. */
  cell: number;
  data: Uint8Array;
}

/**
 * Resample the mask onto a coarse grid: `cols` cells along the longest side.
 * A cell is filled when at least `coverage` of its pixels are ink.
 */
export function sampleGrid(mask: Mask, cols: number, coverage = 0.5): GridSample {
  const cell = Math.max(mask.width, mask.height) / Math.max(1, cols);
  const gw = Math.max(1, Math.ceil(mask.width / cell));
  const gh = Math.max(1, Math.ceil(mask.height / cell));
  const data = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    const y0 = Math.floor(gy * cell);
    const y1 = Math.min(mask.height, Math.max(y0 + 1, Math.floor((gy + 1) * cell)));
    for (let gx = 0; gx < gw; gx++) {
      const x0 = Math.floor(gx * cell);
      const x1 = Math.min(mask.width, Math.max(x0 + 1, Math.floor((gx + 1) * cell)));
      let on = 0;
      let n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          on += mask.data[y * mask.width + x];
          n++;
        }
      data[gy * gw + gx] = n > 0 && on / n >= coverage ? 1 : 0;
    }
  }
  return { cols: gw, rows: gh, cell, data };
}

/**
 * Screen-door transparency: the game draws every element with one solid colour, so partial
 * opacity is emulated by keeping only some grid rows (a horizontal hatch).
 * opacity 1 keeps everything; 0.5 keeps every second row, etc.
 */
export function applyRowHatch(grid: GridSample, opacity: number): void {
  if (opacity >= 0.999) return;
  const period = 4;
  const keep = Math.max(1, Math.round(opacity * period));
  for (let y = 0; y < grid.rows; y++) {
    if (y % period < keep) continue;
    grid.data.fill(0, y * grid.cols, (y + 1) * grid.cols);
  }
}

/**
 * Greedy cover of the filled cells with as few axis-aligned rectangles as practical:
 * grow right as far as possible, then grow down while the whole span stays filled.
 * Output is in grid cells.
 */
export function coverWithRects(grid: GridSample): Rect[] {
  const { cols, rows, data } = grid;
  const used = new Uint8Array(cols * rows);
  const free = (x: number, y: number) => data[y * cols + x] === 1 && used[y * cols + x] === 0;
  const out: Rect[] = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      if (!free(x, y)) continue;
      let w = 1;
      while (x + w < cols && free(x + w, y)) w++;
      let h = 1;
      grow: while (y + h < rows) {
        for (let k = 0; k < w; k++) if (!free(x + k, y + h)) break grow;
        h++;
      }
      for (let yy = y; yy < y + h; yy++) used.fill(1, yy * cols + x, yy * cols + x + w);
      out.push({ x, y, w, h });
    }
  return out;
}
