import { Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { uid, type ElementsConfig, type SightProject } from '../core/sight/model';
import { useI18n, type TKey } from '../i18n';
import type { Ops } from '../state/ops';
import { Button, Hint, NumberField, Segmented, Slider, TextField, Toggle, cx } from './ui';

function ElementCard({ title, enabled, onToggle, children }: { title: string; enabled: boolean; onToggle: (v: boolean) => void; children: ReactNode }) {
  return (
    <div className={cx('rounded-xl border transition-colors', enabled ? 'border-accent/35 bg-base/40' : 'border-line bg-base/20')}>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <span className={cx('text-sm font-medium', enabled ? 'text-ink' : 'text-muted')}>{title}</span>
        <Toggle checked={enabled} onChange={onToggle} label={undefined} />
      </div>
      {enabled && <div className="space-y-3 border-t border-line/60 px-3 pb-3 pt-3">{children}</div>}
    </div>
  );
}

function DistancesField({ value, onChange, label }: { value: number[]; onChange: (v: number[]) => void; label: string }) {
  const [text, setText] = useState(value.join(', '));
  const parsed = text
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map(Number);
  const valid = parsed.length > 0 && parsed.every((n) => Number.isFinite(n) && n > 0);
  return (
    <TextField
      label={label}
      value={text}
      mono
      invalid={!valid}
      onChange={(v) => {
        setText(v);
        const nums = v.split(/[,;\s]+/).filter(Boolean).map(Number);
        if (nums.length && nums.every((n) => Number.isFinite(n) && n > 0)) onChange(nums);
      }}
    />
  );
}

export function ElementsPanel({ project, op }: { project: SightProject; op: Ops }) {
  const { t } = useI18n();
  const el = project.elements;
  const m = t('common.mils');
  const card = <K extends keyof ElementsConfig>(key: K, children: ReactNode) => (
    <ElementCard key={key} title={t(`elements.${key}` as TKey)} enabled={el[key].enabled} onToggle={(enabled) => op.element(key, { enabled } as Partial<ElementsConfig[K]>)}>
      {children}
    </ElementCard>
  );

  return (
    <div className="space-y-2">
      {card(
        'centerDot',
        <>
          <Segmented
            size="sm"
            value={el.centerDot.shape}
            onChange={(shape) => op.element('centerDot', { shape })}
            options={[
              { value: 'circle', label: t('elements.shapeCircle') },
              { value: 'square', label: t('elements.shapeSquare') },
              { value: 'diamond', label: t('elements.shapeDiamond') },
            ]}
          />
          <Slider label={t('elements.diameter')} value={el.centerDot.diameter} min={0.1} max={6} step={0.1} unit={m} onChange={(diameter) => op.element('centerDot', { diameter })} />
        </>,
      )}
      {card(
        'crosshair',
        <>
          <Segmented
            size="sm"
            value={el.crosshair.style}
            onChange={(style) => op.element('crosshair', { style })}
            options={[
              { value: 'line', label: t('elements.styleLine') },
              { value: 'bar', label: t('elements.styleBar') },
            ]}
          />
          <Slider label={t('elements.gap')} value={el.crosshair.gap} min={0} max={30} step={0.5} unit={m} onChange={(gap) => op.element('crosshair', { gap })} />
          <Slider label={t('elements.length')} value={el.crosshair.length} min={1} max={200} step={0.5} unit={m} onChange={(length) => op.element('crosshair', { length })} />
          {el.crosshair.style === 'bar' && (
            <Slider label={t('elements.thickness')} value={el.crosshair.thickness} min={0.1} max={4} step={0.1} unit={m} onChange={(thickness) => op.element('crosshair', { thickness })} />
          )}
          <div>
            <span className="mb-1 block text-xs text-muted">{t('elements.arms')}</span>
            <div className="grid grid-cols-4 gap-1.5">
              {(['top', 'bottom', 'left', 'right'] as const).map((k) => (
                <Button key={k} size="sm" variant={el.crosshair[k] ? 'primary' : 'outline'} onClick={() => op.element('crosshair', { [k]: !el.crosshair[k] })}>
                  {t(`elements.${k}`)}
                </Button>
              ))}
            </div>
          </div>
        </>,
      )}
      {card(
        'horizontalLine',
        <>
          <Slider label={t('elements.gap')} value={el.horizontalLine.gap} min={0} max={100} step={0.5} unit={m} onChange={(gap) => op.element('horizontalLine', { gap })} />
          <Slider label={t('elements.length')} value={el.horizontalLine.length} min={2} max={400} unit={m} onChange={(length) => op.element('horizontalLine', { length })} />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label={t('elements.tickStep')} value={el.horizontalLine.tickStep} step={1} unit={m} onChange={(tickStep) => op.element('horizontalLine', { tickStep: Math.max(0, tickStep) })} />
            <NumberField label={t('elements.tickSize')} value={el.horizontalLine.tickSize} step={0.5} unit={m} onChange={(tickSize) => op.element('horizontalLine', { tickSize: Math.max(0, tickSize) })} />
          </div>
          <Toggle small checked={el.horizontalLine.labels} onChange={(labels) => op.element('horizontalLine', { labels })} label={t('elements.labels')} />
        </>,
      )}
      {card(
        'verticalLine',
        <>
          <Slider label={t('elements.gap')} value={el.verticalLine.gap} min={0} max={100} step={0.5} unit={m} onChange={(gap) => op.element('verticalLine', { gap })} />
          <Slider label={t('elements.lengthUp')} value={el.verticalLine.lengthUp} min={0} max={400} unit={m} onChange={(lengthUp) => op.element('verticalLine', { lengthUp })} />
          <Slider label={t('elements.lengthDown')} value={el.verticalLine.lengthDown} min={0} max={400} unit={m} onChange={(lengthDown) => op.element('verticalLine', { lengthDown })} />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label={t('elements.tickStep')} value={el.verticalLine.tickStep} step={1} unit={m} onChange={(tickStep) => op.element('verticalLine', { tickStep: Math.max(0, tickStep) })} />
            <NumberField label={t('elements.tickSize')} value={el.verticalLine.tickSize} step={0.5} unit={m} onChange={(tickSize) => op.element('verticalLine', { tickSize: Math.max(0, tickSize) })} />
          </div>
        </>,
      )}
      {card(
        'rangefinder',
        <>
          <Hint>{t('elements.rangefinderHint')}</Hint>
          <Slider label={t('elements.targetHeight')} value={el.rangefinder.targetHeight} min={1} max={5} step={0.1} unit="m" onChange={(targetHeight) => op.element('rangefinder', { targetHeight })} />
          <DistancesField label={t('elements.distances')} value={el.rangefinder.distances} onChange={(distances) => op.element('rangefinder', { distances })} />
          <div className="grid grid-cols-3 gap-2">
            <NumberField label={t('elements.posX')} value={el.rangefinder.x} unit={m} onChange={(x) => op.element('rangefinder', { x })} />
            <NumberField label={t('elements.posY')} value={el.rangefinder.y} unit={m} onChange={(y) => op.element('rangefinder', { y })} />
            <NumberField label={t('elements.spacing')} value={el.rangefinder.spacing} step={0.5} unit={m} onChange={(spacing) => op.element('rangefinder', { spacing })} />
          </div>
          <Toggle small checked={el.rangefinder.labels} onChange={(labels) => op.element('rangefinder', { labels })} label={t('elements.labels')} />
        </>,
      )}
      {card(
        'distanceTicks',
        <>
          <Hint tone="warn">{t('elements.distanceHint')}</Hint>
          <div className="grid grid-cols-3 gap-2">
            <NumberField label={t('elements.maxDistance')} value={el.distanceTicks.maxDistance} step={100} onChange={(maxDistance) => op.element('distanceTicks', { maxDistance: Math.min(10000, Math.max(100, maxDistance)) })} />
            <NumberField label={t('elements.step')} value={el.distanceTicks.step} step={50} onChange={(step) => op.element('distanceTicks', { step: Math.max(50, step) })} />
            <NumberField label={t('elements.labelEvery')} value={el.distanceTicks.labelEvery} step={100} onChange={(labelEvery) => op.element('distanceTicks', { labelEvery: Math.max(0, labelEvery) })} />
          </div>
          <Slider label={t('elements.tickPos')} value={el.distanceTicks.posX} min={-0.4} max={0.4} step={0.005} digits={3} onChange={(posX) => op.element('distanceTicks', { posX })} />
          <Slider label={t('elements.tickLength')} value={el.distanceTicks.tickLength} min={0.002} max={0.08} step={0.001} digits={3} onChange={(tickLength) => op.element('distanceTicks', { tickLength })} />
          <Toggle small checked={el.distanceTicks.drawUpward} onChange={(drawUpward) => op.element('distanceTicks', { drawUpward })} label={t('elements.drawUpward')} />
          <Slider label={t('elements.previewSpeed')} value={el.distanceTicks.previewSpeed} min={200} max={1800} step={10} onChange={(previewSpeed) => op.element('distanceTicks', { previewSpeed })} />
        </>,
      )}
      {card(
        'circles',
        <>
          {el.circles.items.map((c, i) => (
            <div key={c.id} className="rounded-lg border border-line/70 p-2">
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
                <span>#{i + 1}</span>
                <button type="button" aria-label={t('elements.delete')} className="text-muted hover:text-red-300" onClick={() => op.element('circles', { items: el.circles.items.filter((x) => x.id !== c.id) })}>
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['diameter', t('elements.diameter'), m, 0.5],
                    ['size', t('elements.lineThickness'), '', 0.1],
                    ['x', 'X', m, 0.5],
                    ['y', 'Y', m, 0.5],
                    ['start', `${t('elements.segment')} ⟲`, '', 5],
                    ['end', `${t('elements.segment')} ⟳`, '', 5],
                  ] as const
                ).map(([k, label, unit, step]) => (
                  <NumberField
                    key={k}
                    label={label}
                    unit={unit}
                    step={step}
                    value={c[k]}
                    onChange={(v) => op.element('circles', { items: el.circles.items.map((x) => (x.id === c.id ? { ...x, [k]: v } : x)) })}
                  />
                ))}
              </div>
            </div>
          ))}
          <Button size="sm" onClick={() => op.element('circles', { items: [...el.circles.items, { id: uid(), x: 0, y: 0, diameter: 16, size: 1.5, start: 0, end: 360 }] })}>
            <Plus size={14} /> {t('elements.add')}
          </Button>
        </>,
      )}
      {card(
        'customLines',
        <>
          {el.customLines.items.map((l, i) => (
            <div key={l.id} className="flex items-end gap-1.5">
              <span className="pb-1.5 text-[11px] text-muted">#{i + 1}</span>
              {(['x1', 'y1', 'x2', 'y2'] as const).map((k) => (
                <NumberField key={k} label={k} step={0.5} value={l[k]} onChange={(v) => op.element('customLines', { items: el.customLines.items.map((x) => (x.id === l.id ? { ...x, [k]: v } : x)) })} />
              ))}
              <button type="button" aria-label={t('elements.delete')} className="pb-1.5 text-muted hover:text-red-300" onClick={() => op.element('customLines', { items: el.customLines.items.filter((x) => x.id !== l.id) })}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <Button size="sm" onClick={() => op.element('customLines', { items: [...el.customLines.items, { id: uid(), x1: -10, y1: 20, x2: 10, y2: 20 }] })}>
            <Plus size={14} /> {t('elements.add')}
          </Button>
          <p className="text-[11px] text-muted">{t('common.mils')}: x → , y ↓</p>
        </>,
      )}
    </div>
  );
}
