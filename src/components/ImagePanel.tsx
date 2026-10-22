import { Crosshair, FlipHorizontal2, FlipVertical2, RotateCcw } from 'lucide-react';
import type { MaskSource } from '../core/image/preprocess';
import type { ArtGeometry, TraceMode } from '../core/image/trace';
import type { SightProject } from '../core/sight/model';
import { useI18n } from '../i18n';
import type { Ops } from '../state/ops';
import { Button, ColorField, Hint, Segmented, Select, Slider, Toggle } from './ui';

export function ImageTracePanel({ project, op, geometry }: { project: SightProject; op: Ops; geometry: ArtGeometry | null }) {
  const { t } = useI18n();
  const tr = project.artwork.trace;
  const edges = tr.source === 'edges';
  const srcLabel: Record<string, string> = {
    alpha: t('image.srcAlpha'),
    dark: t('image.srcDark'),
    light: t('image.srcLight'),
    edges: t('image.srcEdges'),
  };
  return (
    <>
      <Toggle checked={project.artwork.enabled} onChange={(v) => op.artwork({ enabled: v })} label={t('image.enabled')} />
      <div>
        <span className="mb-1 block text-xs text-muted">{t('image.mode')}</span>
        <Segmented<TraceMode>
          value={tr.mode}
          onChange={(mode) => op.trace({ mode })}
          options={[
            { value: 'fill', label: t('image.modeFill') },
            { value: 'outline', label: t('image.modeOutline') },
            { value: 'both', label: t('image.modeBoth') },
          ]}
        />
        <p className="mt-1 text-[11px] text-muted">{t('image.modeHint')}</p>
      </div>
      <Select<MaskSource>
        label={t('image.source')}
        value={tr.source}
        onChange={(source) => op.trace({ source, threshold: source === 'edges' ? 40 : 128 })}
        options={[
          { value: 'auto', label: t('image.srcAuto') },
          { value: 'alpha', label: t('image.srcAlpha') },
          { value: 'dark', label: t('image.srcDark') },
          { value: 'light', label: t('image.srcLight') },
          { value: 'edges', label: t('image.srcEdges') },
        ]}
      />
      {tr.source === 'auto' && geometry && (
        <p className="-mt-1 text-[11px] text-muted">
          {t('image.resolved')} <span className="text-ink/80">{srcLabel[geometry.resolvedSource]}</span>
        </p>
      )}
      {(edges || geometry?.resolvedSource === 'dark' || geometry?.resolvedSource === 'light' || tr.source === 'dark' || tr.source === 'light') && (
        <Slider label={edges ? t('image.edgeThreshold') : t('image.threshold')} value={tr.threshold} min={edges ? 5 : 1} max={edges ? 160 : 254} onChange={(threshold) => op.trace({ threshold })} />
      )}
      <div className="grid grid-cols-2 gap-2">
        <Toggle small checked={tr.removeBackground} onChange={(removeBackground) => op.trace({ removeBackground })} label={t('image.removeBg')} />
        <Toggle small checked={tr.invert} onChange={(invert) => op.trace({ invert })} label={t('image.invert')} />
      </div>
      {tr.removeBackground && <Slider label={t('image.bgTolerance')} value={tr.bgTolerance} min={2} max={140} onChange={(bgTolerance) => op.trace({ bgTolerance })} />}
      {tr.mode !== 'outline' && <Slider label={t('image.detail')} value={tr.fillDetail} min={12} max={200} onChange={(fillDetail) => op.trace({ fillDetail })} />}
      {tr.mode !== 'fill' && <Slider label={t('image.simplify')} value={tr.simplify} min={0.3} max={6} step={0.1} onChange={(simplify) => op.trace({ simplify })} />}
      <Slider label={t('image.minSpeck')} value={tr.minSpeck} min={0} max={200} onChange={(minSpeck) => op.trace({ minSpeck })} />
      <Slider
        label={t('image.opacity')}
        value={Math.round(tr.opacity * 100)}
        min={25}
        max={100}
        step={25}
        unit="%"
        onChange={(v) => op.trace({ opacity: v / 100 })}
        hint={t('image.opacityHint')}
      />
      <ColorField label={t('image.color')} value={project.globals.color} onChange={(color) => op.globals({ color })} />
    </>
  );
}

export function ImageTransformPanel({ project, op }: { project: SightProject; op: Ops }) {
  const { t } = useI18n();
  const a = project.artwork;
  const mil = t('common.mils');
  return (
    <>
      <Slider label={t('image.size')} value={a.size} min={2} max={300} step={0.5} unit={mil} onChange={(size) => op.artwork({ size })} />
      <Slider label={t('image.rotation')} value={a.rotation} min={-180} max={180} unit="°" onChange={(rotation) => op.artwork({ rotation })} />
      <Slider label={t('image.offsetX')} value={a.offsetX} min={-150} max={150} step={0.5} unit={mil} onChange={(offsetX) => op.artwork({ offsetX })} />
      <Slider label={t('image.offsetY')} value={a.offsetY} min={-150} max={150} step={0.5} unit={mil} onChange={(offsetY) => op.artwork({ offsetY })} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={a.flipX ? 'primary' : 'outline'} onClick={() => op.artwork({ flipX: !a.flipX })}>
          <FlipHorizontal2 size={14} /> {t('image.flipX')}
        </Button>
        <Button size="sm" variant={a.flipY ? 'primary' : 'outline'} onClick={() => op.artwork({ flipY: !a.flipY })}>
          <FlipVertical2 size={14} /> {t('image.flipY')}
        </Button>
        <Button size="sm" onClick={() => op.artwork({ offsetX: 0, offsetY: 0 })}>
          <Crosshair size={14} /> {t('image.center')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => op.artwork({ offsetX: 0, offsetY: 0, rotation: 0, size: 40, flipX: false, flipY: false })} aria-label="reset">
          <RotateCcw size={14} />
        </Button>
      </div>
      {!project.image && <Hint>{t('upload.formats')}</Hint>}
    </>
  );
}
