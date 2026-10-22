import { motion } from 'framer-motion';
import { BookOpen, Crosshair, FolderOpen, Github } from 'lucide-react';
import { useI18n, type Lang } from '../i18n';
import { cx } from './ui';

export type Tab = 'generator' | 'my' | 'guide';
export const REPO_URL = 'https://github.com/wilberods-coder/wt-sight-forge';

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 40 40" className="h-8 w-8 sm:h-9 sm:w-9" aria-hidden>
        <circle cx="20" cy="20" r="15" fill="none" stroke="#FF6B35" strokeWidth="2.4" />
        <circle cx="20" cy="20" r="2.4" fill="#FF6B35" />
        <path d="M20 1v10M20 29v10M1 20h10M29 20h10" stroke="#F5F5F5" strokeWidth="2.4" strokeLinecap="square" />
        <path d="M26 31l3 3M14 31l-3 3" stroke="#FF6B35" strokeWidth="1.6" />
      </svg>
      <div className="leading-none">
        <div className="whitespace-nowrap font-display text-[17px] font-bold tracking-[0.12em] text-ink sm:text-xl sm:tracking-[0.18em]">
          WT SIGHT <span className="text-accent">FORGE</span>
        </div>
        <div className="mt-0.5 hidden text-[10px] uppercase tracking-[0.25em] text-muted sm:block">custom reticle generator</div>
      </div>
    </div>
  );
}

export function Header({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const { t, lang, setLang } = useI18n();
  const tabs: { id: Tab; label: string; icon: typeof Crosshair }[] = [
    { id: 'generator', label: t('nav.generator'), icon: Crosshair },
    { id: 'my', label: t('nav.mySights'), icon: FolderOpen },
    { id: 'guide', label: t('nav.guide'), icon: BookOpen },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-base/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 lg:px-6">
        <button type="button" onClick={() => onTab('generator')} className="shrink-0" aria-label="WT Sight Forge">
          <Logo />
        </button>
        <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:ml-6 sm:w-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTab(id)}
              className={cx(
                'relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-[13px] font-medium transition-colors sm:flex-none sm:px-3 sm:text-sm',
                tab === id ? 'text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {tab === id && (
                <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg border border-accent/40 bg-accent/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
              )}
              <Icon size={16} className="relative hidden min-[420px]:block" />
              <span className="relative">{label}</span>
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <div className="flex rounded-lg border border-line bg-panel p-0.5 text-xs font-semibold" role="group" aria-label="Language">
            {(['ru', 'en'] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={cx('rounded-md px-2.5 py-1 uppercase transition-colors', lang === l ? 'bg-accent text-white' : 'text-muted hover:text-ink')}
              >
                {l}
              </button>
            ))}
          </div>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            title={t('app.github')}
            aria-label={t('app.github')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel text-muted transition-colors hover:border-accent/60 hover:text-ink"
          >
            <Github size={17} />
          </a>
        </div>
      </div>
    </header>
  );
}
