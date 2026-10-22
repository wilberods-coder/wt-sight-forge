import { AlertTriangle, Grid3x3, Hand, Image as ImageIcon, Lightbulb, LocateFixed, Maximize, Minus, Plus, ScanLine } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SightProject } from '../core/sight/model';
import { useI18n, type TKey } from '../i18n';
import { renderPreview, type PreviewOptions } from '../lib/render';
import { SCENES, type SceneKind } from '../lib/scenes';
import type { Ops } from '../state/ops';
import type { Pipeline } from '../state/usePipeline';
import { COLOR_PRESETS, cx } from './ui';

const SCENE_SWATCH: Record<SceneKind, string> = {
  steppe: 'linear-gradient(#7d9fc4 50%,#8f8a55 50%)',
  forest: 'linear-gradient(#83a0bd 50%,#3c4a2a 50%)',
  desert: 'linear-gradient(#93b6d8 50%,#cfae78 50%)',
  winter: 'linear-gradient(#a7b8c9 50%,#e6ebf0 50%)',
  night: 'linear-gradient(#0b1220 50%,#151c12 50%)',
  gray: 'linear-gradient(#6b737e 50%,#5f666f 50%)',
};
const SCENE_KEY: Record<SceneKind, TKey> = {
  steppe: 'preview.bgSteppe',
  forest: 'preview.bgForest',
  desert: 'preview.bgDesert',
  winter: 'preview.bgWinter',
  night: 'preview.bgNight',
  gray: 'preview.bgGray',
};

/** Vertical field of view at ×1, in mils (≈ 14°, a typical wide gunner-sight view). */
const BASE_FOV = 240;

export const DEFAULT_VIEW: PreviewOptions & { zoom: number; moveArt: boolean } = {
  scene: 'steppe',
  fovMils: BASE_FOV / 3,
  zoom: 3,
  panX: 0,
  panY: 0,
  grid: false,
  centerMark: false,
  showSource: false,
  sourceOpacity: 0.4,
  light: false,
  mask: false,
  moveArt: false,
};
export type ViewState = typeof DEFAULT_VIEW;

function Tool({ active, onClick, children, label }: { active?: boolean; onClick: () => void; children: ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={active}
      className={cx(
        'flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors',
        active ? 'border-accent/70 bg-accent/15 text-ink' : 'border-line bg-panel2 text-muted hover:text-ink',
      )}
    >
      {children}
      <span className="hidden 2xl:inline">{label}</span>
    </button>
  );
}

export function PreviewPanel({
  project,
  op,
  pipe,
  view,
  setView,
  canvasRef,
}: {
  project: SightProject;
  op: Ops;
  pipe: Pipeline;
  view: ViewState;
  setView: (fn: (v: ViewState) => ViewState) => void;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
}) {
  const { t } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 450, dpr: 1 });
  const drag = useRef<{ id: number; x: number; y: number }[]>([]);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(200, r.width), h: Math.max(150, r.height), dpr: Math.min(2, window.devicePixelRatio || 1) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const setZoom = (z: number) => setView((v) => ({ ...v, zoom: Math.min(24, Math.max(1, z)), fovMils: BASE_FOV / Math.min(24, Math.max(1, z)) }));

  // Render whenever anything visible changes.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const W = Math.round(size.w * size.dpr);
    const H = Math.round(size.h * size.dpr);
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    const id = requestAnimationFrame(() => {
      const ctx = c.getContext('2d');
      if (ctx)
        renderPreview(ctx, W, H, {
          prims: pipe.prims,
          globals: project.globals,
          elements: project.elements,
          artwork: pipe.artwork,
          source: pipe.imageEl,
          opts: view,
        });
    });
    return () => cancelAnimationFrame(id);
  }, [size, pipe.prims, pipe.imageEl, project.globals, project.elements, pipe.artwork, view, canvasRef]);

  // Wheel zoom needs a non-passive listener.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => {
        const z = Math.min(24, Math.max(1, v.zoom * Math.pow(1.0015, -e.deltaY)));
        return { ...v, zoom: z, fovMils: BASE_FOV / z };
      });
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [canvasRef, setView]);

  const ppmCss = size.h / view.fovMils;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current.push({ id: e.pointerId, x: e.clientX, y: e.clientY });
    if (drag.current.length === 2) {
      const [a, b] = drag.current;
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = drag.current.find((d) => d.id === e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (drag.current.length === 2 && pinch.current) {
      const [a, b] = drag.current;
      setZoom(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist));
      return;
    }
    if (view.moveArt) {
      // Dragging switches the artwork from a corner preset to a custom position.
      const k = pipe.artwork.anchor === 'screen' ? 1 / size.h : 1 / ppmCss;
      const r = (v: number) => Math.round(v * 10000) / 10000;
      op.artwork({ preset: null, offsetX: r(pipe.artwork.offsetX + dx * k), offsetY: r(pipe.artwork.offsetY + dy * k) });
    }
    else setView((v) => ({ ...v, panX: v.panX + dx / ppmCss, panY: Math.max(-200, Math.min(200, v.panY + dy / ppmCss)) }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    drag.current = drag.current.filter((d) => d.id !== e.pointerId);
    if (drag.current.length < 2) pinch.current = null;
  };

  const toggle = (k: 'grid' | 'centerMark' | 'showSource' | 'light' | 'mask' | 'moveArt') => setView((v) => ({ ...v, [k]: !v[k] }));
  const c = pipe.counts;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line/70 px-3 py-2">
        <div className="flex items-center gap-1" role="group" aria-label={t('preview.background')}>
          {SCENES.map((s) => (
            <button
              key={s}
              type="button"
              title={t(SCENE_KEY[s])}
              aria-label={t(SCENE_KEY[s])}
              aria-pressed={view.scene === s}
              onClick={() => setView((v) => ({ ...v, scene: s }))}
              className={cx('h-7 w-7 rounded-md border-2 transition-transform hover:scale-110', view.scene === s ? 'border-accent' : 'border-transparent')}
              style={{ background: SCENE_SWATCH[s] }}
            />
          ))}
        </div>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <div className="flex items-center gap-1">
          <button type="button" aria-label="zoom out" className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel2 text-muted hover:text-ink" onClick={() => setZoom(view.zoom / 1.25)}>
            <Minus size={14} />
          </button>
          <span className="w-12 text-center font-mono text-xs text-ink" title={t('preview.zoom')}>
            ×{view.zoom.toFixed(1)}
          </span>
          <button type="button" aria-label="zoom in" className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel2 text-muted hover:text-ink" onClick={() => setZoom(view.zoom * 1.25)}>
            <Plus size={14} />
          </button>
        </div>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <Tool active={view.grid} onClick={() => toggle('grid')} label={t('preview.grid')}>
          <Grid3x3 size={14} />
        </Tool>
        <Tool active={view.centerMark} onClick={() => toggle('centerMark')} label={t('preview.centerMark')}>
          <LocateFixed size={14} />
        </Tool>
        <Tool active={view.showSource} onClick={() => toggle('showSource')} label={t('preview.source')}>
          <ImageIcon size={14} />
        </Tool>
        <Tool active={view.light} onClick={() => toggle('light')} label={t('preview.light')}>
          <Lightbulb size={14} />
        </Tool>
        <Tool active={view.mask} onClick={() => toggle('mask')} label={t('preview.mask')}>
          <ScanLine size={14} />
        </Tool>
        <Tool active={view.moveArt} onClick={() => toggle('moveArt')} label={t('preview.moveArt')}>
          <Hand size={14} />
        </Tool>
        <Tool onClick={() => setView((v) => ({ ...v, panX: 0, panY: 0, zoom: 3, fovMils: BASE_FOV / 3 }))} label={t('preview.reset')}>
          <Maximize size={14} />
        </Tool>
      </div>

      <div ref={wrapRef} className="relative aspect-[4/3] w-full overflow-hidden bg-black sm:aspect-video xl:aspect-auto xl:min-h-[420px] xl:flex-1">
        <canvas
          ref={canvasRef}
          data-testid="preview-canvas"
          className={cx('absolute inset-0 h-full w-full touch-none', view.moveArt ? 'cursor-move' : 'cursor-grab active:cursor-grabbing')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <div className="pointer-events-none absolute bottom-2 left-2 right-2 truncate rounded bg-black/55 px-2 py-1 font-mono text-[9px] text-ink/80 sm:right-auto sm:text-[10px]">
          {t('preview.stats', c)} · FOV {view.fovMils.toFixed(0)} {t('common.mils')}
        </div>
        <div className="pointer-events-none absolute right-2 top-2 hidden rounded bg-black/55 px-2 py-1 text-[10px] text-ink/70 sm:block">{t('preview.targets')}</div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/70 px-3 py-2">
        <label className="flex items-center gap-2 text-xs text-muted">
          {t('settings.lineSize')}
          <input type="range" min={0.3} max={4} step={0.1} value={project.globals.lineSizeMult} onChange={(e) => op.globals({ lineSizeMult: parseFloat(e.target.value) })} className="wt-range w-28" />
          <span className="w-8 font-mono text-ink">{project.globals.lineSizeMult.toFixed(1)}</span>
        </label>
        <div className="flex items-center gap-1">
          {COLOR_PRESETS.slice(0, 6).map((col) => (
            <button
              key={col.join()}
              type="button"
              aria-label={`color ${col.join(',')}`}
              onClick={() => op.globals({ color: [...col, project.globals.color[3]] as [number, number, number, number] })}
              className={cx('h-5 w-5 rounded border', project.globals.color.slice(0, 3).join() === col.join() ? 'border-white' : 'border-line')}
              style={{ background: `rgb(${col.join(',')})` }}
            />
          ))}
        </div>
        {view.showSource && (
          <label className="flex items-center gap-2 text-xs text-muted">
            {t('preview.source')}
            <input type="range" min={0.1} max={1} step={0.05} value={view.sourceOpacity} onChange={(e) => setView((v) => ({ ...v, sourceOpacity: parseFloat(e.target.value) }))} className="wt-range w-20" />
          </label>
        )}
      </div>
      <div className="flex items-start gap-2 border-t border-line/70 px-3 py-2 text-[11px] leading-snug text-amber-200/90">
        <AlertTriangle size={14} className="mt-px shrink-0" />
        <span>
          {t('preview.warning')} <span className="text-muted">{t('preview.hint')}</span>
        </span>
      </div>
    </div>
  );
}
