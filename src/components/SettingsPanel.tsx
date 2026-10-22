import type { SightProject, ThousandthType } from '../core/sight/model';
import { useI18n } from '../i18n';
import type { Ops } from '../state/ops';
import { ColorField, Select, Slider, Toggle } from './ui';

export function SettingsPanel({ project, op }: { project: SightProject; op: Ops }) {
  const { t } = useI18n();
  const g = project.globals;
  return (
    <>
      <Select<ThousandthType>
        label={t('settings.thousandth')}
        value={g.thousandth}
        onChange={(thousandth) => op.globals({ thousandth })}
        options={[
          { value: 'ussr', label: t('settings.thousandthUssr') },
          { value: 'nato', label: t('settings.thousandthNato') },
          { value: 'real', label: t('settings.thousandthReal') },
        ]}
      />
      <Slider label={t('settings.lineSize')} value={g.lineSizeMult} min={0.3} max={4} step={0.1} onChange={(lineSizeMult) => op.globals({ lineSizeMult })} />
      <Slider label={t('settings.fontSize')} value={g.fontSizeMult} min={0.3} max={3} step={0.1} onChange={(fontSizeMult) => op.globals({ fontSizeMult })} />
      <ColorField label={t('image.color')} value={g.color} onChange={(color) => op.globals({ color })} />
      <Slider label="Alpha" value={g.color[3]} min={40} max={255} onChange={(a) => op.globals({ color: [g.color[0], g.color[1], g.color[2], Math.round(a)] })} />
      <ColorField label={t('settings.lightColor')} value={g.lightColor} onChange={(lightColor) => op.globals({ lightColor })} />
      <Toggle small checked={g.drawDistanceCorrection} onChange={(drawDistanceCorrection) => op.globals({ drawDistanceCorrection })} label={t('settings.distanceCorrection')} />
    </>
  );
}
