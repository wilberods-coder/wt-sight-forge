/** Plain RGBA raster, same layout as the browser's ImageData (works in Node tests too). */
export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Binary mask: 1 = "ink" (part of the sight), 0 = empty. */
export interface Mask {
  width: number;
  height: number;
  data: Uint8Array;
}

export const createMask = (width: number, height: number): Mask => ({ width, height, data: new Uint8Array(width * height) });

export const cloneRaster = (r: Raster): Raster => ({ width: r.width, height: r.height, data: new Uint8ClampedArray(r.data) });

export const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Nearest-neighbour/box downscale so processing cost stays bounded. */
export function downscale(src: Raster, maxSide: number): Raster {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  if (scale >= 1) return src;
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const out = new Uint8ClampedArray(w * h * 4);
  const fx = src.width / w;
  const fy = src.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * fy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * fx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * src.width + xx) * 4;
          const al = src.data[i + 3];
          // Alpha-weighted colour so transparent pixels do not darken edges.
          r += src.data[i] * al;
          g += src.data[i + 1] * al;
          b += src.data[i + 2] * al;
          a += al;
          n++;
        }
      const o = (y * w + x) * 4;
      out[o] = a ? r / a : 0;
      out[o + 1] = a ? g / a : 0;
      out[o + 2] = a ? b / a : 0;
      out[o + 3] = a / n;
    }
  }
  return { width: w, height: h, data: out };
}
