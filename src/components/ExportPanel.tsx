import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Copy, Download, FileArchive, FileCode2, FolderUp, Info, Loader2, Save, XCircle, Zap } from 'lucide-react';
import { useRef, useState } from 'react';
import { ELEMENT_SOFT_LIMIT } from '../core/blk/validate';
import { compileSight, type CompileResult } from '../core/sight/compile';
import type { SightProject } from '../core/sight/model';
import { en } from '../i18n/en';
import { ru } from '../i18n/ru';
import { useI18n, type TKey } from '../i18n';
import { downloadText, downloadZip, projectFileName, projectToJson } from '../lib/download';
import { parseProjectFile, saveProject } from '../lib/storage';
import type { Ops, SetProject } from '../state/ops';
import type { Pipeline } from '../state/usePipeline';
import { Button, Hint, Segmented, TextField, Toggle, cx } from './ui';

const CODE_PREVIEW_LINES = 400;

export function thumbnailFrom(canvas: HTMLCanvasElement | null): string | undefined {
  if (!canvas) return undefined;
  try {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = Math.round((320 * canvas.height) / canvas.width) || 180;
    c.getContext('2d')!.drawImage(canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.75);
  } catch {
    return undefined;
  }
}

export function ExportPanel({
  project,
  op,
  setProject,
  pipe,
  canvasRef,
}: {
  project: SightProject;
  op: Ops;
  setProject: SetProject;
  pipe: Pipeline;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
}) {
  const { t, list } = useI18n();
  const g = project.globals;
  const [result, setResult] = useState<{ r: CompileResult; at: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const vehicle = g.folder !== 'all_tanks';

  const flash = (text: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 2600);
  };

  const generate = () => {
    setBusy(true);
    // Let the button state paint before the (synchronous) compile.
    setTimeout(() => {
      const r = compileSight({ globals: g, elements: project.elements, prims: pipe.prims });
      setResult({ r, at: project.updatedAt });
      setBusy(false);
    }, 30);
  };

  const ok = result && result.r.report.ok && result.r.configErrors.length === 0;
  const stale = result && result.at !== project.updatedAt;
  const errors = result ? result.r.report.issues.filter((i) => i.severity === 'error') : [];
  const warnings = result ? result.r.report.issues.filter((i) => i.severity === 'warning') : [];
  const codeLines = result ? result.r.text.split('\n') : [];

  return (
    <div className="space-y-4 p-4">
      <TextField
        label={t('export.fileName')}
        value={g.fileName}
        mono
        invalid={!/^[A-Za-z0-9_-]+$/.test(g.fileName)}
        onChange={(fileName) => op.globals({ fileName: fileName.replace(/\s+/g, '_') })}
      />
      <div>
        <span className="mb-1 block text-xs text-muted">{t('export.folder')}</span>
        <Segmented
          size="sm"
          value={vehicle ? 'vehicle' : 'all'}
          onChange={(v) => op.globals({ folder: v === 'all' ? 'all_tanks' : '' })}
          options={[
            { value: 'all', label: 'all_tanks' },
            { value: 'vehicle', label: t('export.folderVehicle') },
          ]}
        />
        <div className="mt-2">
          {vehicle ? (
            <TextField value={g.folder} mono placeholder={t('export.vehicleId')} invalid={!/^[A-Za-z0-9_]+$/.test(g.folder)} onChange={(folder) => op.globals({ folder: folder.trim() })} />
          ) : (
            <div className="space-y-1.5 rounded-lg border border-line/70 p-2.5">
              <span className="block text-[11px] text-muted">{t('export.classes')}</span>
              {(['exp_tank', 'exp_heavy_tank', 'exp_tank_destroyer', 'exp_SPAA'] as const).map((k) => (
                <Toggle key={k} small checked={g.matchClasses[k]} onChange={(v) => op.globals({ matchClasses: { ...g.matchClasses, [k]: v } })} label={`${t(`export.${k}` as TKey)} · ${k}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      {pipe.counts.total > ELEMENT_SOFT_LIMIT && <Hint tone="warn">{t('export.tooMany', { n: pipe.counts.total })}</Hint>}

      <motion.button
        type="button"
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.98 }}
        onClick={generate}
        disabled={busy}
        data-testid="generate"
        className="group relative w-full overflow-hidden rounded-xl bg-accent px-4 py-4 font-display text-xl font-bold tracking-[0.2em] text-white shadow-glow disabled:opacity-70"
      >
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <span className="relative flex items-center justify-center gap-2">
          {busy ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
          {busy ? t('export.generating') : t('export.generate')}
        </span>
      </motion.button>

      <AnimatePresence>
        {result && (
          <motion.div
            key={result.r.text.length + ':' + result.at}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            data-testid="result"
            className={cx('space-y-3 rounded-xl border p-3', ok ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5')}
          >
            <div className="flex items-start gap-2 text-sm">
              {ok ? <CheckCircle2 size={18} className="mt-px shrink-0 text-emerald-400" /> : <XCircle size={18} className="mt-px shrink-0 text-red-400" />}
              <span className={ok ? 'text-emerald-200' : 'text-red-200'}>{ok ? t('export.resultOk') : t('export.resultFail')}</span>
            </div>
            {stale && <Hint tone="warn">{t('export.stale')}</Hint>}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted">{t('export.file')}</dt>
              <dd className="break-all font-mono text-ink" data-testid="result-file">
                {result.r.fileName}
              </dd>
              <dt className="text-muted">{t('export.path')}</dt>
              <dd className="break-all font-mono text-ink/85">{result.r.installPath}</dd>
              <dt className="text-muted">{t('export.size')}</dt>
              <dd className="font-mono text-ink/85">{(result.r.bytes / 1024).toFixed(1)} KB</dd>
              <dt className="text-muted">{t('export.elements')}</dt>
              <dd className="font-mono text-ink/85">{t('preview.stats', result.r.report.counts)}</dd>
            </dl>
            {result.r.configErrors.map((e) => (
              <Hint key={e} tone="error">
                {t(`export.errors.${e}` as TKey)}
              </Hint>
            ))}
            {errors.length > 0 && (
              <Hint tone="error">
                <ul className="list-disc space-y-0.5 pl-4">
                  {errors.slice(0, 8).map((e, i) => (
                    <li key={i}>{e.line ? `L${e.line}: ` : ''}{e.message}</li>
                  ))}
                </ul>
              </Hint>
            )}
            {warnings.length > 0 && (
              <Hint tone="warn">
                <b>{t('export.warnings')}:</b> {warnings.slice(0, 5).map((w) => w.message).join('; ')}
              </Hint>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" disabled={!ok} onClick={() => downloadText(result.r.text, result.r.fileName)} data-testid="download-blk">
                <Download size={15} /> {t('export.downloadBlk')}
              </Button>
              <Button disabled={!ok} onClick={() => downloadZip(result.r, project, { ru, en })} data-testid="download-zip">
                <FileArchive size={15} /> {t('export.downloadZip')}
              </Button>
            </div>
            <p className="text-[11px] text-muted">{t('export.zipHint')}</p>
            <div className="flex items-start gap-2 text-[11px] leading-snug text-sky-200/80">
              <Info size={13} className="mt-px shrink-0" />
              {t('export.needsGameCheck')}
            </div>
            <div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowCode((s) => !s)}>
                  <FileCode2 size={14} /> {showCode ? t('export.hideCode') : t('export.showCode')}
                </Button>
                {showCode && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard?.writeText(result.r.text).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      });
                    }}
                  >
                    <Copy size={14} /> {copied ? t('export.copied') : t('export.copy')}
                  </Button>
                )}
              </div>
              {showCode && (
                <div className="mt-2">
                  <pre className="max-h-72 overflow-auto rounded-lg border border-line bg-base p-2.5 font-mono text-[10.5px] leading-relaxed text-ink/85" data-testid="blk-code">
                    {codeLines.slice(0, CODE_PREVIEW_LINES).join('\n')}
                  </pre>
                  {codeLines.length > CODE_PREVIEW_LINES && <p className="mt-1 text-[11px] text-muted">{t('export.codeTruncated', { n: CODE_PREVIEW_LINES })}</p>}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-3 gap-2 border-t border-line/70 pt-4">
        <Button
          size="sm"
          onClick={async () => {
            try {
              await saveProject({ project: { ...project, name: g.fileName, updatedAt: Date.now() }, thumbnail: thumbnailFrom(canvasRef.current) });
              flash(t('export.saved'));
            } catch {
              flash('IndexedDB error', 'error');
            }
          }}
          data-testid="save-project"
        >
          <Save size={14} /> <span className="truncate">{t('export.saveProject')}</span>
        </Button>
        <Button size="sm" onClick={() => fileRef.current?.click()}>
          <FolderUp size={14} /> <span className="truncate">{t('export.loadProject')}</span>
        </Button>
        <Button size="sm" onClick={() => downloadText(projectToJson(project), projectFileName(project), 'application/json')}>
          <Download size={14} /> <span className="truncate">{t('export.exportProject')}</span>
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
              setProject(() => p);
              setResult(null);
              flash(t('export.loaded'));
            } catch {
              flash(t('export.badProject'), 'error');
            }
          }}
        />
      </div>
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Hint tone={toast.tone}>{toast.text}</Hint>
          </motion.div>
        )}
      </AnimatePresence>

      <details className="group rounded-lg border border-line/70 p-3 text-xs text-muted">
        <summary className="cursor-pointer font-medium text-ink/85">{t('export.limitsTitle')}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {list('export.limits').map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
