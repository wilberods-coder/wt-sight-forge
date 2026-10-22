import JSZip from 'jszip';
import type { CompileResult } from '../core/sight/compile';
import type { SightProject } from '../core/sight/model';
import type { Dict } from '../i18n/ru';

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadText(text: string, name: string, type = 'text/plain') {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), name);
}

export const projectFileName = (p: SightProject) => `${p.globals.fileName || 'sight'}.wtsf.json`;

export function projectToJson(p: SightProject): string {
  return JSON.stringify(p, null, 2);
}

function readme(d: Dict, r: CompileResult, folder: string): string {
  const g = d.guide;
  const lines = [
    `WT SIGHT FORGE — ${r.fileName}`,
    '',
    `1. ${g.step1}`,
    `   ${g.step1text}`,
    `   Windows: C:\\Users\\<user>\\Documents\\My Games\\WarThunder\\Saves\\<ID>\\production\\UserSights`,
    `   Linux:   $HOME/.config/WarThunder/Saves/<ID>/production/UserSights/`,
    `   macOS:   Users/<user>/My Games/WarThunder/Saves/<ID>/production/UserSights/`,
    `   ${g.step1id}`,
    '',
    `2. ${g.step2}: ${folder}`,
    `   ${g.step2text}`,
    '',
    `3. ${g.step3}: ${r.installPath}`,
    `   ${g.step3text}`,
    '',
    `4. ${g.step4}`,
    `   ${g.step4text}`,
    `   ${g.step4menu}`,
    `   ${g.step4menuRu}`,
    `   ${g.step4text2}`,
    '',
    `5. ${g.step5}`,
    `   ${g.step5text}`,
    '',
    g.troubleTitle,
    ...g.trouble.map((s) => ` - ${s}`),
    '',
    d.export.needsGameCheck,
    '',
  ];
  return lines.join('\r\n');
}

/** ZIP layout mirrors the game folder, so it can be extracted straight into Saves/<ID>/production/. */
export function buildZip(r: CompileResult, project: SightProject, dicts: { ru: Dict; en: Dict }): JSZip {
  const zip = new JSZip();
  const folder = project.globals.folder;
  zip.file(`UserSights/${folder}/${r.fileName}`, r.text);
  zip.file('README_RU.txt', readme(dicts.ru, r, folder));
  zip.file('README_EN.txt', readme(dicts.en, r, folder));
  zip.file(`project/${projectFileName(project)}`, projectToJson(project));
  return zip;
}

export async function downloadZip(r: CompileResult, project: SightProject, dicts: { ru: Dict; en: Dict }) {
  const blob = await buildZip(r, project, dicts).generateAsync({ type: 'blob', compression: 'DEFLATE' });
  downloadBlob(blob, `${project.globals.fileName}_wt_sight.zip`);
}
