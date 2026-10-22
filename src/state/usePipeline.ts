import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { Raster } from '../core/image/raster';
import { traceArtwork, type ArtGeometry } from '../core/image/trace';
import { buildElementPrims, placeArtwork } from '../core/sight/elements';
import type { Prim, SightProject } from '../core/sight/model';
import { imageToRaster, loadImageElement } from '../lib/imageLoad';

export interface Pipeline {
  imageEl: HTMLImageElement | null;
  raster: Raster | null;
  geometry: ArtGeometry | null;
  prims: Prim[];
  counts: { lines: number; quads: number; circles: number; texts: number; total: number };
  traceMs: number;
}

export function countPrims(prims: Prim[]) {
  const c = { lines: 0, quads: 0, circles: 0, texts: 0, total: prims.length };
  for (const p of prims) {
    if (p.kind === 'line') c.lines++;
    else if (p.kind === 'quad') c.quads++;
    else if (p.kind === 'circle') c.circles++;
    else c.texts++;
  }
  return c;
}

/** Image → mask → geometry → primitives, recomputed only when the relevant inputs change. */
export function usePipeline(project: SightProject): Pipeline {
  const dataUrl = project.image?.dataUrl ?? null;
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let alive = true;
    if (!dataUrl) {
      setImageEl(null);
      return;
    }
    loadImageElement(dataUrl)
      .then((img) => alive && setImageEl(img))
      .catch(() => alive && setImageEl(null));
    return () => {
      alive = false;
    };
  }, [dataUrl]);

  const raster = useMemo(() => (imageEl ? imageToRaster(imageEl) : null), [imageEl]);
  // Tracing runs on deferred settings so slider drags stay smooth.
  const trace = useDeferredValue(project.artwork.trace);
  const { geometry, traceMs } = useMemo(() => {
    if (!raster) return { geometry: null, traceMs: 0 };
    const t0 = performance.now();
    const geometry = traceArtwork(raster, trace);
    return { geometry, traceMs: performance.now() - t0 };
  }, [raster, trace]);

  const a = project.artwork;
  const artPrims = useMemo(
    () => (geometry && a.enabled ? placeArtwork(geometry, a) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geometry, a.enabled, a.size, a.rotation, a.offsetX, a.offsetY, a.flipX, a.flipY],
  );
  const elementPrims = useMemo(() => buildElementPrims(project.elements, project.globals), [project.elements, project.globals.thousandth]); // eslint-disable-line react-hooks/exhaustive-deps
  const prims = useMemo(() => [...artPrims, ...elementPrims], [artPrims, elementPrims]);
  const counts = useMemo(() => countPrims(prims), [prims]);

  return { imageEl, raster, geometry, prims, counts, traceMs };
}
