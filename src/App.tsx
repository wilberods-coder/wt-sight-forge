import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Header, REPO_URL, type Tab } from './components/Header';
import { DEFAULT_VIEW, type ViewState } from './components/PreviewPanel';
import { newProject, type SightProject } from './core/sight/model';
import { useI18n } from './i18n';
import { loadDraft, saveDraft } from './lib/storage';
import { GeneratorPage } from './pages/GeneratorPage';
import { GuidePage } from './pages/GuidePage';
import { MySightsPage } from './pages/MySightsPage';

const TABS: Tab[] = ['generator', 'my', 'guide'];
const tabFromHash = (): Tab => {
  const h = window.location.hash.replace(/^#\/?/, '') as Tab;
  return TABS.includes(h) ? h : 'generator';
};

export default function App() {
  const { t } = useI18n();
  const [tab, setTabState] = useState<Tab>(tabFromHash);
  const [project, setProjectState] = useState<SightProject>(() => newProject());
  const [view, setView] = useState<ViewState>(DEFAULT_VIEW);
  const draftLoaded = useRef(false);

  const setTab = useCallback((tb: Tab) => {
    setTabState(tb);
    window.history.replaceState(null, '', `#/${tb}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  useEffect(() => {
    const onHash = () => setTabState(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setProject = useCallback((fn: (p: SightProject) => SightProject) => setProjectState(fn), []);

  // Restore the last draft once, then autosave (debounced) to IndexedDB.
  useEffect(() => {
    loadDraft().then((d) => {
      if (d) setProjectState(d);
      draftLoaded.current = true;
    });
  }, []);
  useEffect(() => {
    if (!draftLoaded.current) return;
    const id = setTimeout(() => saveDraft(project), 700);
    return () => clearTimeout(id);
  }, [project]);

  return (
    <div className="min-h-screen bg-base text-ink">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,107,53,.08),transparent_55%)]" />
      <Header tab={tab} onTab={setTab} />
      <main className="relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {tab === 'generator' && <GeneratorPage project={project} setProject={setProject} view={view} setView={setView} />}
            {tab === 'my' && (
              <MySightsPage
                onOpen={(p) => {
                  setProjectState(p);
                  setTab('generator');
                }}
              />
            )}
            {tab === 'guide' && <GuidePage />}
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="relative mx-auto max-w-[1680px] px-4 pb-8 pt-4 text-center text-[11px] text-muted lg:px-6">
        WT Sight Forge — {t('app.tagline')}. War Thunder is a trademark of Gaijin Entertainment; this is an unofficial fan tool. ·{' '}
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-ink">
          GitHub
        </a>
      </footer>
    </div>
  );
}
