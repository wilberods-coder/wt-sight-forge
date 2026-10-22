import { ArrowDownLeft, ArrowDownRight, ArrowUpLeft, ArrowUpRight, Crosshair, FlipHorizontal2, FlipVertical2, RotateCcw } from 'lucide-react';
import type { MaskSource } from '../core/image/preprocess';
import type { ArtGeometry, TraceMode } from '../core/image/trace';
import { DEFAULT_ARTWORK, type ArtAnchor, type ArtPreset, type ArtworkSettings, type SightProject } from '../core/sight/model';
import { useI18n, type TKey } from '../i18n';
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

const PRESETS: { id: ArtPreset; icon: typeof ArrowUpRight; key: TKey }[] = [
  { id: 'topLeft', icon: ArrowUpLeft, key: 'image.presetTopLeft' },
  { id: 'topRight', icon: ArrowUpRight, key: 'image.presetTopRight' },
  { id: 'center', icon: Crosshair, key: 'image.presetCenter' },
  { id: 'bottomLeft', icon: ArrowDownLeft, key: 'image.presetBottomLeft' },
  { id: 'bottomRight', icon: ArrowDownRight, key: 'image.presetBottomRight' },
];

export function ImageTransformPanel({ project, op, resolved }: { project: SightProject; op: Ops; resolved: ArtworkSettings }) {
  const { t } = useI18n();
  const a = project.artwork;
  const screen = a.anchor === 'screen';
  // Screen units are shown as % of the screen height, mils as they are.
  const k = screen ? 100 : 1;
  const unit = screen ? t('image.screenUnit') : t('common.mils');
  const defaults = screen ? DEFAULT_ARTWORK.size : 40;
  return (
    <>
      <div>
        <span className="mb-1 block text-xs text-muted">{t('image.anchor')}</span>
        <Segmented<ArtAnchor>
          value={a.anchor}
          onChange={(anchor) => anchor !== a.anchor && op.artwork({ anchor, size: anchor === 'screen' ? DEFAULT_ARTWORK.size : 40, preset: a.preset ?? 'topRight', offsetX: 0, offsetY: 0 })}
          options={[
            { value: 'screen', label: t('image.anchorScreen') },
            { value: 'mils', label: t('image.anchorMils') },
          ]}
        />
        <p className="mt-1 text-[11px] leading-snug text-muted">{t('image.anchorHint')}</p>
      </div>
      <div>
        <span className="mb-1 block text-xs text-muted">{t('image.position')}</span>
        <div className="grid grid-cols-5 gap-1.5">
          {PRESETS.map(({ id, icon: Icon, key }) => (
            <Button key={id} size="sm" variant={a.preset === id ? 'primary' : 'outline'} title={t(key)} aria-label={t(key)} aria-pressed={a.preset === id} onClick={() => op.artwork({ preset: id })}>
              <Icon size={15} />
            </Button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted">{a.preset ? t(PRESETS.find((p) => p.id === a.preset)!.key) : t('image.custom')}</p>
      </div>
      <Slider label={t('image.size')} value={a.size * k} min={screen ? 5 : 2} max={screen ? 150 : 300} step={screen ? 1 : 0.5} unit={unit} onChange={(v) => op.artwork({ size: v / k })} />
      <Slider label={t('image.rotation')} value={a.rotation} min={-180} max={180} unit="°" onChange={(rotation) => op.artwork({ rotation })} />
      <Slider
        label={t('image.offsetX')}
        value={resolved.offsetX * k}
        min={screen ? -100 : -150}
        max={screen ? 100 : 150}
        step={screen ? 0.5 : 0.5}
        unit={unit}
        onChange={(v) => op.artwork({ preset: null, offsetX: v / k, offsetY: resolved.offsetY })}
      />
      <Slider
        label={t('image.offsetY')}
        value={resolved.offsetY * k}
        min={screen ? -60 : -150}
        max={screen ? 60 : 150}
        step={0.5}
        unit={unit}
        onChange={(v) => op.artwork({ preset: null, offsetY: v / k, offsetX: resolved.offsetX })}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={a.flipX ? 'primary' : 'outline'} onClick={() => op.artwork({ flipX: !a.flipX })}>
          <FlipHorizontal2 size={14} /> {t('image.flipX')}
        </Button>
        <Button size="sm" variant={a.flipY ? 'primary' : 'outline'} onClick={() => op.artwork({ flipY: !a.flipY })}>
          <FlipVertical2 size={14} /> {t('image.flipY')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => op.artwork({ preset: 'topRight', offsetX: 0, offsetY: 0, rotation: 0, size: defaults, flipX: false, flipY: false })}
          aria-label="reset"
        >
          <RotateCcw size={14} />
        </Button>
      </div>
      {!project.image && <Hint>{t('upload.formats')}</Hint>}
    </>
  );
}
