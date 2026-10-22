import { AnimatePresence, motion } from 'framer-motion';
import { ImagePlus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { ArtGeometry } from '../core/image/trace';
import type { SightProject } from '../core/sight/model';
import { useI18n } from '../i18n';
import { ACCEPT_ATTR, fileToProjectImage, isAcceptedFile, maskToDataUrl, urlToFile } from '../lib/imageLoad';
import type { SetProject } from '../state/ops';
import { Button, Hint, Segmented, cx } from './ui';

const SAMPLES = [
  { file: 'emblem_transparent.png', key: 'upload.sampleEmblem' },
  { file: 'shield_white_bg.jpg', key: 'upload.sampleShield' },
  { file: 'complex_scene.jpg', key: 'upload.sampleScene' },
] as const;

const safeBaseName = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

export function UploadPanel({ project, setProject, geometry }: { project: SightProject; setProject: SetProject; geometry: ArtGeometry | null }) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'original' | 'mask'>('original');

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!isAcceptedFile(file)) {
      setError(t('upload.badType'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const image = await fileToProjectImage(file);
      const base = safeBaseName(file.name);
      setProject((p) => {
        // Follow the image name unless the user typed their own file name.
        const auto = p.globals.fileName === 'my_sight' || (p.image && p.globals.fileName === safeBaseName(p.image.fileName));
        return {
          ...p,
          image,
          updatedAt: Date.now(),
          artwork: { ...p.artwork, enabled: true },
          globals: auto && base ? { ...p.globals, fileName: base } : p.globals,
        };
      });
    } catch {
      setError(t('upload.loadError'));
    } finally {
      setBusy(false);
    }
  };

  const loadSample = async (file: string) => {
    try {
      await handleFile(await urlToFile(`${import.meta.env.BASE_URL}samples/${file}`, file));
    } catch {
      setError(t('upload.loadError'));
    }
  };

  const c = project.globals.color;
  const maskUrl = useMemo(() => (geometry && view === 'mask' ? maskToDataUrl(geometry.mask, [c[0], c[1], c[2]]) : null), [geometry, view, c]);

  const img = project.image;
  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept={ACCEPT_ATTR} className="hidden" onChange={(e) => handleFile(e.target.files?.[0]).then(() => (e.target.value = ''))} />
      <AnimatePresence mode="wait" initial={false}>
        {!img ? (
          <motion.div
            key="drop"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
            data-testid="dropzone"
            className={cx(
              'group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
              drag ? 'border-accent bg-accent/10' : 'border-line bg-base/50 hover:border-accent/60',
            )}
          >
            <motion.div animate={drag ? { scale: 1.12 } : { scale: 1 }} className="rounded-full bg-accent/10 p-3 text-accent">
              {busy ? <RefreshCw className="animate-spin" size={26} /> : <Upload size={26} />}
            </motion.div>
            <div className="text-sm text-ink">
              {t('upload.drop')} <span className="text-muted">{t('upload.or')}</span> <span className="text-accent underline underline-offset-2">{t('upload.browse')}</span>
            </div>
            <div className="text-[11px] text-muted">{t('upload.formats')}</div>
          </motion.div>
        ) : (
          <motion.div key="thumb" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            <div
              className="checker relative flex h-40 items-center justify-center overflow-hidden rounded-xl border border-line"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0]);
              }}
            >
              <img src={view === 'mask' && maskUrl ? maskUrl : img.dataUrl} alt={img.fileName} className="max-h-full max-w-full object-contain" />
              <div className="absolute left-2 top-2 max-w-[70%] truncate rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-ink/80">
                {img.fileName} · {img.width}×{img.height}
              </div>
            </div>
            <Segmented
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: 'original', label: t('upload.view.original') },
                { value: 'mask', label: t('upload.view.mask') },
              ]}
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => inputRef.current?.click()}>
                <ImagePlus size={14} /> {t('upload.replace')}
              </Button>
              <Button size="sm" variant="danger" onClick={() => setProject((p) => ({ ...p, image: null, updatedAt: Date.now() }))}>
                <Trash2 size={14} /> {t('upload.remove')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <Hint tone="error">{error}</Hint>}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
        <span>{t('upload.samples')}</span>
        {SAMPLES.map((s) => (
          <button key={s.file} type="button" onClick={() => loadSample(s.file)} className="rounded-md border border-line px-2 py-0.5 text-ink/80 transition-colors hover:border-accent/60 hover:text-ink">
            {t(s.key)}
          </button>
        ))}
      </div>
    </div>
  );
}
