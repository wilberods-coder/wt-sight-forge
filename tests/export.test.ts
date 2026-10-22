import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { validateSightText } from '../src/core/blk/validate';
import { compileSight } from '../src/core/sight/compile';
import { buildElementPrims } from '../src/core/sight/elements';
import { newProject, normalizeProject } from '../src/core/sight/model';
import { en } from '../src/i18n/en';
import { ru } from '../src/i18n/ru';
import { buildZip, projectToJson } from '../src/lib/download';
import { parseProjectFile } from '../src/lib/storage';

const compile = (name = 'zip_test') => {
  const p = newProject(name);
  p.elements.rangefinder.enabled = true;
  return { p, r: compileSight({ globals: p.globals, elements: p.elements, prims: buildElementPrims(p.elements, p.globals) }) };
};

describe('export', () => {
  it('generated .blk is plain ASCII', () => {
    const { r } = compile();
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(r.text)).toBe(true);
  });

  it('ZIP contains the UserSights structure, both READMEs and the project', async () => {
    const { p, r } = compile();
    const bytes = await buildZip(r, p, { ru, en }).generateAsync({ type: 'uint8array' });
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
    expect(names).toEqual(['README_EN.txt', 'README_RU.txt', 'UserSights/all_tanks/zip_test.blk', 'project/zip_test.wtsf.json']);
    const blk = await zip.file('UserSights/all_tanks/zip_test.blk')!.async('string');
    expect(blk).toBe(r.text);
    expect(validateSightText(blk).ok).toBe(true);
    const readme = await zip.file('README_RU.txt')!.async('string');
    expect(readme).toContain('UserSights/all_tanks/zip_test.blk');
    expect(readme).toContain('Alt + F9');
  });

  it('project files round-trip and old/partial projects are normalised', () => {
    const { p } = compile();
    const back = parseProjectFile(projectToJson(p));
    expect(back).toEqual(p);
    expect(() => parseProjectFile('{"hello":1}')).toThrow();
    const partial = normalizeProject({ globals: { fileName: 'x' } as never });
    expect(partial.elements.crosshair.length).toBeGreaterThan(0);
    expect(partial.globals.thousandth).toBe('ussr');
  });
});
