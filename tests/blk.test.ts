import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findBlocks, getParam, parseBlk } from '../src/core/blk/parser';
import { B, P2, P4, R, T, block, param } from '../src/core/blk/types';
import { isConvexQuad, validateSightText } from '../src/core/blk/validate';
import { formatNumber, writeBlk } from '../src/core/blk/writer';

const fx = (name: string) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

describe('real War Thunder sight samples', () => {
  it('parses the community UserSights template (comments in every position)', () => {
    const r = parseBlk(fx('community_template.blk'));
    expect(r.issues).toEqual([]);
    expect(getParam(r.doc.children, 'thousandth')).toEqual({ type: 't', value: 'ussr' });
    expect(findBlocks(r.doc.children, 'drawQuads')).toHaveLength(1);
    const v = validateSightText(fx('community_template.blk'));
    expect(v.ok).toBe(true);
    expect(v.counts).toMatchObject({ lines: 1, quads: 1, circles: 1, texts: 1 });
  });

  it('parses the wiki default range scales', () => {
    const v = validateSightText(fx('wiki_default_scales.blk'));
    expect(v.ok).toBe(true);
    const r = parseBlk(fx('wiki_default_scales.blk'));
    expect(findBlocks(r.doc.children, 'crosshair_distances')[0].children).toHaveLength(14);
    expect(findBlocks(r.doc.children, 'crosshair_hor_ranges')[0].children).toHaveLength(16);
  });

  it('parses the wiki T-55A ballistics block (nested bullets, Cyrillic comments)', () => {
    const r = parseBlk(fx('wiki_t55_ballistics.blk'));
    expect(r.ok).toBe(true);
    const bullets = findBlocks(findBlocks(r.doc.children, 'ballistics')[0].children, 'bullet');
    expect(bullets).toHaveLength(3);
    expect(getParam(bullets[0].children, 'speed')).toEqual({ type: 'r', value: 1430 });
  });

  it('catches the typo in the wiki P40 example ("3,5" in a p4)', () => {
    const r = parseBlk(fx('wiki_p40_it_san_giorgio_x4.blk'));
    const errors = r.issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toMatch(/p4 expects 4/);
    // Once the decimal comma is fixed the file is valid.
    const fixed = parseBlk(fx('wiki_p40_it_san_giorgio_x4.blk').replace(/3,5;/g, '3.5;'));
    expect(fixed.issues).toEqual([]);
    const inner = findBlocks(fixed.doc.children, 'it_san_giorgio_x4')[0];
    expect(findBlocks(inner.children, 'drawLines')[0].children.filter((c) => c.kind === 'block')).toHaveLength(26);
  });

  it('catches the unclosed drawTexts block in the wiki snippet, accepts the corrected one', () => {
    const r = parseBlk(fx('wiki_draw_blocks.blk'));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => /never closed/.test(i.message))).toBe(true);
    const v = validateSightText(fx('wiki_draw_blocks_fixed.blk'));
    expect(v.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(v.counts).toMatchObject({ lines: 2, texts: 1, circles: 1, quads: 2 });
  });
});

describe('syntax checks', () => {
  it('rejects wrong types and malformed values', () => {
    const bad = ['textAlign:i = 1,5', 'fontSizeMult:r = 1e-5', 'crosshairColor:c = 300, 0, 0, 255', 'thousandth:t = ussr', 'x:q = 1', '1bad:r = 1'];
    for (const line of bad) expect(parseBlk(line).ok, line).toBe(false);
  });

  it('accepts every boolean spelling from the wiki', () => {
    for (const v of ['yes', 'no', 'on', 'off', 'true', 'false', '1', '0']) expect(parseBlk(`drawCentralLineVert:b = ${v}`).ok).toBe(true);
  });

  it('reports mixing crosshair_distances formats', () => {
    const v = validateSightText('crosshair_distances {\n distance:p2 = 200, 2\n distance:p3 = 400, 4, 0\n}');
    expect(v.ok).toBe(false);
  });

  it('detects non-convex quads', () => {
    expect(isConvexQuad([[0, 0], [10, 0], [10, 10], [0, 10]])).toBe(true);
    expect(isConvexQuad([[0, 0], [10, 0], [2, 2], [0, 10]])).toBe(false);
    expect(isConvexQuad([[0, 0], [10, 0], [5, 8], [5, 8]])).toBe(true); // triangle
  });
});

describe('writer', () => {
  it('never writes exponent notation or -0', () => {
    expect(formatNumber(0.0000001)).toBe('0');
    expect(formatNumber(-0.00001)).toBe('0');
    expect(() => formatNumber(1e21)).toThrow();
    expect(formatNumber(123456.78)).toBe('123456.78');
    expect(formatNumber(12.5)).toBe('12.5');
    expect(formatNumber(-3)).toBe('-3');
    expect(() => formatNumber(NaN)).toThrow();
  });

  it('round-trips through the strict parser', () => {
    const doc = {
      children: [
        param('thousandth', T('ussr')),
        param('lineSizeMult', R(1.5)),
        block('drawLines', [block('line', [param('line', P4(-0.0000001, 2, 3.25, -4)), param('move', B(false)), param('thousandth', B(true))], { inline: true })]),
        block('drawTexts', [block('text', [param('text', T('4')), param('pos', P2(1, 2))], { inline: true })]),
      ],
    };
    const text = writeBlk(doc);
    expect(text).toContain('line { line:p4 = 0, 2, 3.25, -4; move:b = no; thousandth:b = yes; }');
    const r = parseBlk(text);
    expect(r.issues).toEqual([]);
    expect(validateSightText(text).ok).toBe(true);
  });
});
