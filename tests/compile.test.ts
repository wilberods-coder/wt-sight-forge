import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { findBlocks, getParam, parseBlk } from '../src/core/blk/parser';
import { isConvexQuad } from '../src/core/blk/validate';
import { DEFAULT_TRACE, traceArtwork } from '../src/core/image/trace';
import { compileSight, distanceList } from '../src/core/sight/compile';
import { buildElementPrims, placeArtwork } from '../src/core/sight/elements';
import { newProject, type Prim } from '../src/core/sight/model';

const emblem = () => {
  const png = PNG.sync.read(fs.readFileSync(path.join(__dirname, 'fixtures', 'emblem_transparent.png')));
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
};

function allElementsProject() {
  const p = newProject('test_sight');
  for (const k of Object.keys(p.elements) as (keyof typeof p.elements)[]) p.elements[k].enabled = true;
  return p;
}

describe('compileSight', () => {
  it('a sight with every standard element is valid and complete', () => {
    const p = allElementsProject();
    const prims = buildElementPrims(p.elements, p.globals);
    const out = compileSight({ globals: p.globals, elements: p.elements, prims, date: new Date('2026-01-01') });
    expect(out.configErrors).toEqual([]);
    expect(out.report.issues).toEqual([]);
    expect(out.report.ok).toBe(true);
    expect(out.fileName).toBe('test_sight.blk');
    expect(out.installPath).toBe('UserSights/all_tanks/test_sight.blk');

    const count = (k: Prim['kind']) => prims.filter((x) => x.kind === k).length;
    expect(out.report.counts).toMatchObject({ lines: count('line'), quads: count('quad'), circles: count('circle'), texts: count('text') });

    const doc = parseBlk(out.text).doc.children;
    expect(getParam(doc, 'drawCentralLineVert')).toEqual({ type: 'b', value: false });
    expect(findBlocks(doc, 'matchExpClass')[0].children).toHaveLength(4);
    expect(findBlocks(doc, 'crosshair_distances')[0].children).toHaveLength(distanceList(p.elements.distanceTicks).length);
  });

  it('a vehicle-specific folder has no matchExpClass block', () => {
    const p = newProject('t34');
    p.globals.folder = 'ussr_t_34_85_zis_53';
    const out = compileSight({ globals: p.globals, elements: p.elements, prims: buildElementPrims(p.elements, p.globals) });
    expect(out.installPath).toBe('UserSights/ussr_t_34_85_zis_53/t34.blk');
    expect(findBlocks(parseBlk(out.text).doc.children, 'matchExpClass')).toHaveLength(0);
  });

  it('rejects bad file and folder names before writing', () => {
    const p = newProject('bad name!');
    p.globals.folder = 'all tanks';
    const out = compileSight({ globals: p.globals, elements: p.elements, prims: buildElementPrims(p.elements, p.globals) });
    expect(out.configErrors).toEqual(expect.arrayContaining(['fileName', 'folder']));
  });

  it.each([
    { rotation: 0, flipX: false, flipY: false },
    { rotation: 33, flipX: false, flipY: false },
    { rotation: -90, flipX: true, flipY: false },
    { rotation: 147, flipX: true, flipY: true },
  ])('image artwork compiles to convex quads (%o)', (t) => {
    const p = newProject('emblem');
    Object.assign(p.artwork, t, { size: 30, offsetX: 5, offsetY: -12 });
    const geo = traceArtwork(emblem(), { ...DEFAULT_TRACE, mode: 'both' });
    const art = placeArtwork(geo, p.artwork);
    const prims = [...art, ...buildElementPrims(p.elements, p.globals)];
    const out = compileSight({ globals: p.globals, elements: p.elements, prims });
    expect(out.report.ok).toBe(true);
    expect(out.report.issues.filter((i) => i.severity === 'error')).toEqual([]);
    for (const q of art.filter((x) => x.kind === 'quad')) if (q.kind === 'quad') expect(isConvexQuad(q.p)).toBe(true);
    // Size is preserved: artwork spans ~30 mils, centred on the offset.
    const xs = art.flatMap((x) => (x.kind === 'quad' ? x.p.map((v) => v[0]) : []));
    const ys = art.flatMap((x) => (x.kind === 'quad' ? x.p.map((v) => v[1]) : []));
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    expect(span).toBeGreaterThan(20);
    expect(span).toBeLessThan(43);
    expect(out.text).not.toMatch(/\d[eE][+-]?\d/);
    expect(out.text).not.toMatch(/NaN|Infinity/);
  });

  it('output stays reasonably small for a detailed image', () => {
    const p = newProject('big');
    const geo = traceArtwork(emblem(), { ...DEFAULT_TRACE, mode: 'fill', fillDetail: 160 });
    const out = compileSight({ globals: p.globals, elements: p.elements, prims: placeArtwork(geo, p.artwork) });
    expect(out.report.ok).toBe(true);
    expect(out.bytes).toBeLessThan(600_000);
  });
});
