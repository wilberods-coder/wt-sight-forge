import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { findBlocks, getParam, parseBlk } from '../src/core/blk/parser';
import { isConvexQuad } from '../src/core/blk/validate';
import { DEFAULT_TRACE, traceArtwork } from '../src/core/image/trace';
import { compileSight, distanceList } from '../src/core/sight/compile';
import { PRESET_GAP, artworkBounds, buildElementPrims, placeArtwork, resolveArtwork } from '../src/core/sight/elements';
import { newProject, normalizeProject, type Prim } from '../src/core/sight/model';

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

describe('screen-anchored artwork (WTDraw-style art sights)', () => {
  const geo = () => traceArtwork(emblem(), { ...DEFAULT_TRACE, mode: 'both' });

  it('new projects put the art up-right of the crosshair in screen units', () => {
    const p = newProject('art');
    expect(p.artwork.anchor).toBe('screen');
    expect(p.artwork.preset).toBe('topRight');
    const g = geo();
    const art = placeArtwork(g, resolveArtwork(g, p.artwork));
    const b = artworkBounds(g, resolveArtwork(g, p.artwork))!;
    expect(b).not.toBeNull();
    const pts = art.flatMap((x) => (x.kind === 'quad' ? x.p : x.kind === 'line' ? [x.a, x.b] : []));
    const minX = Math.min(...pts.map((v) => v[0]));
    const maxY = Math.max(...pts.map((v) => v[1]));
    const minY = Math.min(...pts.map((v) => v[1]));
    expect(minX).toBeCloseTo(PRESET_GAP.screen, 3); // just right of the vertical line
    expect(maxY).toBeCloseTo(-PRESET_GAP.screen, 3); // just above the horizontal line
    expect(minY).toBeGreaterThan(-0.5); // stays inside the screen height
    expect(art.every((x) => (x.kind === 'quad' || x.kind === 'line') && x.screen)).toBe(true);
  });

  it.each(['topLeft', 'bottomRight', 'bottomLeft', 'center'] as const)('preset %s lands in its quadrant', (preset) => {
    const g = geo();
    const a = resolveArtwork(g, { ...newProject().artwork, preset });
    const pts = placeArtwork(g, a).flatMap((x) => (x.kind === 'quad' ? x.p : x.kind === 'line' ? [x.a, x.b] : []));
    const xs = pts.map((v) => v[0]);
    const ys = pts.map((v) => v[1]);
    if (preset === 'center') {
      expect(a.offsetX).toBe(0);
      return;
    }
    if (preset.endsWith('Left')) expect(Math.max(...xs)).toBeLessThan(0);
    else expect(Math.min(...xs)).toBeGreaterThan(0);
    if (preset.startsWith('top')) expect(Math.max(...ys)).toBeLessThan(0);
    else expect(Math.min(...ys)).toBeGreaterThan(0);
  });

  it('writes art with thousandth:b = no and reticle elements with thousandth:b = yes', () => {
    const p = newProject('art');
    const g = geo();
    const prims = [...placeArtwork(g, resolveArtwork(g, p.artwork)), ...buildElementPrims(p.elements, p.globals)];
    const out = compileSight({ globals: p.globals, elements: p.elements, prims });
    expect(out.report.ok).toBe(true);
    const quads = out.text.split('\n').filter((l) => l.trim().startsWith('quad {'));
    const artQuads = quads.filter((l) => l.includes('thousandth:b = no'));
    expect(artQuads.length).toBe(g.quads.length);
    expect(quads.length - artQuads.length).toBeGreaterThan(0); // the centre dot stays in mils
    for (const l of artQuads)
      for (const [, v] of l.matchAll(/:p2 = ([^;]+);/g)) for (const n of v.split(',').map(Number)) expect(Math.abs(n)).toBeLessThanOrEqual(1);
  });

  it('projects saved before anchoring existed stay in mils at their saved offset', () => {
    const old = normalizeProject({ artwork: { size: 40, offsetX: 5, offsetY: -3 } as never });
    expect(old.artwork.anchor).toBe('mils');
    expect(old.artwork.preset).toBeNull();
    expect(resolveArtwork(geo(), old.artwork).offsetX).toBe(5);
    // An untouched old default (centred, 40 mils) moves to the new up-right screen layout.
    const untouched = normalizeProject({ artwork: { size: 40, offsetX: 0, offsetY: 0, rotation: 0 } as never });
    expect(untouched.artwork.anchor).toBe('screen');
    expect(untouched.artwork.preset).toBe('topRight');
    expect(untouched.artwork.size).toBe(0.45);
  });
});
