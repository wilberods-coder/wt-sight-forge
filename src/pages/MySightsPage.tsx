import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Crosshair, Download, FileCode2, FolderOpen, Pencil, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Hint, Panel } from '../components/ui';
import { traceArtwork } from '../core/image/trace';
import { compileSight } from '../core/sight/compile';
import { buildElementPrims, placeArtwork } from '../core/sight/elements';
import { uid, type SightProject } from '../core/sight/model';
import { useI18n } from '../i18n';
import { downloadText, projectFileName, projectToJson } from '../lib/download';
import { imageToRaster, loadImageElement } from '../lib/imageLoad';
import { deleteProject, listProjects, parseProjectFile, saveProject, type StoredProject } from '../lib/storage';

async function compileStored(p: SightProject) {
  let prims = buildElementPrims(p.elements, p.globals);
  if (p.image && p.artwork.enabled) {
    const img = await loadImageElement(p.image.dataUrl);
    prims = [...placeArtwork(traceArtwork(imageToRaster(img), p.artwork.trace), p.artwork), ...prims];
  }
  return compileSight({ globals: p.globals, elements: p.elements, prims });
}

export function MySightsPage({ onOpen }: { onOpen: (p: SightProject) => void }) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<StoredProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    listProjects()
      .then(setItems)
      .catch(() => {
        setItems([]);
        setError('IndexedDB is not available in this browser mode.');
      });
  }, []);
  useEffect(refresh, [refresh]);

  const fmt = (ms: number) => new Date(ms).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wider text-ink">{t('my.title')}</h1>
        <span className="rounded-md bg-panel px-2 py-0.5 font-mono text-xs text-muted">{items?.length ?? 0}</span>
        <Button size="sm" className="ml-auto" onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> {t('my.importBtn')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const p = parseProjectFile(await f.text());
              await saveProject({ project: { ...p, id: uid(), updatedAt: Date.now() } });
              refresh();
            } catch {
              setError(t('export.badProject'));
            }
          }}
        />
      </div>
      {error && (
        <div className="mb-4">
          <Hint tone="error">{error}</Hint>
        </div>
      )}
      {items && items.length === 0 && (
        <Panel className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <FolderOpen size={36} className="text-accent" />
          <p className="max-w-md text-sm text-muted">{t('my.empty')}</p>
        </Panel>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {items?.map(({ project: p, thumbnail }) => (
            <motion.div key={p.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
              <Panel className="overflow-hidden">
                <button type="button" onClick={() => onOpen(p)} className="block aspect-video w-full bg-base">
                  {thumbnail ? (
                    <img src={thumbnail} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-line">
                      <Crosshair size={48} />
                    </div>
                  )}
                </button>
                <div className="space-y-3 p-3">
                  <div>
                    <div className="truncate font-mono text-sm text-ink">{p.globals.fileName}.blk</div>
                    <div className="text-[11px] text-muted">
                      UserSights/{p.globals.folder} · {t('my.updated')} {fmt(p.updatedAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="primary" onClick={() => onOpen(p)}>
                      <FolderOpen size={13} /> {t('my.open')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        const r = await compileStored(p);
                        if (r.report.ok && !r.configErrors.length) downloadText(r.text, r.fileName);
                        else setError(`${p.globals.fileName}: ${t('export.resultFail')}`);
                      }}
                    >
                      <FileCode2 size={13} /> {t('my.blk')}
                    </Button>
                    <Button size="sm" onClick={() => downloadText(projectToJson(p), projectFileName(p), 'application/json')}>
                      <Download size={13} /> {t('my.project')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('my.rename')}
                      onClick={async () => {
                        const name = window.prompt(t('my.newName'), p.globals.fileName)?.trim();
                        if (!name || !/^[A-Za-z0-9_-]+$/.test(name)) return;
                        await saveProject({ project: { ...p, name, globals: { ...p.globals, fileName: name }, updatedAt: Date.now() }, thumbnail });
                        refresh();
                      }}
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('my.duplicate')}
                      onClick={async () => {
                        const name = `${p.globals.fileName}_copy`;
                        await saveProject({ project: { ...p, id: uid(), name, globals: { ...p.globals, fileName: name }, createdAt: Date.now(), updatedAt: Date.now() }, thumbnail });
                        refresh();
                      }}
                    >
                      <Copy size={13} />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      aria-label={t('my.delete')}
                      className="ml-auto"
                      onClick={async () => {
                        if (!window.confirm(t('my.confirmDelete', { name: p.globals.fileName }))) return;
                        await deleteProject(p.id);
                        refresh();
                      }}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </Panel>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
