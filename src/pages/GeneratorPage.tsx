import { Boxes, Image as ImageIcon, Move, Settings2, Upload } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { ElementsPanel } from '../components/ElementsPanel';
import { ExportPanel } from '../components/ExportPanel';
import { ImageTracePanel, ImageTransformPanel } from '../components/ImagePanel';
import { PreviewPanel, type ViewState } from '../components/PreviewPanel';
import { SettingsPanel } from '../components/SettingsPanel';
import { Panel, Section } from '../components/ui';
import { UploadPanel } from '../components/UploadPanel';
import type { SightProject } from '../core/sight/model';
import { useI18n } from '../i18n';
import { ops, type SetProject } from '../state/ops';
import { usePipeline } from '../state/usePipeline';

export function GeneratorPage({
  project,
  setProject,
  view,
  setView,
}: {
  project: SightProject;
  setProject: SetProject;
  view: ViewState;
  setView: (fn: (v: ViewState) => ViewState) => void;
}) {
  const { t } = useI18n();
  const op = useMemo(() => ops(setProject), [setProject]);
  const pipe = usePipeline(project);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  return (
    <div className="mx-auto grid max-w-[1680px] gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:px-6 xl:grid-cols-[350px_minmax(0,1fr)_340px]">
      {/* Preview first on mobile, centre column on desktop. */}
      <div className="order-1 min-w-0 lg:order-2 xl:sticky xl:top-[72px] xl:h-[calc(100vh-88px)]">
        <Panel className="h-full overflow-hidden">
          <PreviewPanel project={project} op={op} pipe={pipe} view={view} setView={setView} canvasRef={canvasRef} />
        </Panel>
      </div>

      <div className="order-2 min-w-0 space-y-4 lg:order-1 lg:row-span-2 xl:row-span-1">
        <Panel>
          <Section title={t('upload.title')} icon={<Upload size={16} />}>
            <UploadPanel project={project} setProject={setProject} geometry={pipe.geometry} />
          </Section>
          <Section title={t('image.title')} icon={<ImageIcon size={16} />}>
            <ImageTracePanel project={project} op={op} geometry={pipe.geometry} />
          </Section>
          <Section title={t('image.transform')} icon={<Move size={16} />}>
            <ImageTransformPanel project={project} op={op} />
          </Section>
        </Panel>
        <Panel>
          <Section title={t('elements.title')} icon={<Boxes size={16} />}>
            <ElementsPanel project={project} op={op} />
          </Section>
          <Section title={t('settings.title')} icon={<Settings2 size={16} />} defaultOpen={false}>
            <SettingsPanel project={project} op={op} />
          </Section>
        </Panel>
      </div>

      <div className="order-3 min-w-0 lg:col-start-2 xl:col-start-3 xl:row-start-1">
        <Panel className="xl:sticky xl:top-[72px]">
          <div className="border-b border-line/70 px-4 py-3 font-display text-[15px] font-semibold uppercase tracking-wider text-ink/90">{t('export.title')}</div>
          <ExportPanel project={project} op={op} setProject={setProject} pipe={pipe} canvasRef={canvasRef} />
        </Panel>
      </div>
    </div>
  );
}
