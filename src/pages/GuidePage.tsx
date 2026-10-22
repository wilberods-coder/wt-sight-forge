import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Copy, ExternalLink, FileDown, FolderTree, Gamepad2, ListChecks, ShieldAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { REPO_URL } from '../components/Header';
import { Hint, Panel } from '../components/ui';
import { useI18n } from '../i18n';

const PATHS = [
  { os: 'windows', path: 'C:\\Users\\<user>\\Documents\\My Games\\WarThunder\\Saves\\<ID>\\production\\UserSights' },
  { os: 'linux', path: '$HOME/.config/WarThunder/Saves/<ID>/production/UserSights/' },
  { os: 'mac', path: 'Users/<user>/My Games/WarThunder/Saves/<ID>/production/UserSights/' },
] as const;

const SOURCES = [
  { label: 'War Thunder Wiki — User-made sighting reticles', url: 'https://wiki.warthunder.com/User-made_sighting_reticles' },
  { label: 'War Thunder Wiki — creation sight (CDK)', url: 'https://wiki.warthunder.com/creation_sight' },
  { label: 'Gaijin Store — profile (user ID)', url: 'https://store.gaijin.net/user.php' },
];

function CopyPath({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-base px-3 py-2">
      <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-ink/90">{text}</code>
      <button
        type="button"
        aria-label="copy"
        onClick={() => navigator.clipboard?.writeText(text).then(() => (setOk(true), setTimeout(() => setOk(false), 1200)))}
        className="shrink-0 text-muted hover:text-ink"
      >
        {ok ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Copy size={15} />}
      </button>
    </div>
  );
}

function Step({ n, title, icon, children }: { n: number; title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.3 }}>
      <Panel className="relative overflow-hidden p-5">
        <div className="absolute -right-3 -top-6 select-none font-display text-[110px] font-bold leading-none text-white/[.03]">{n}</div>
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 font-display text-lg font-bold text-accent">{n}</span>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-ink">
            {icon} {title}
          </h2>
        </div>
        <div className="space-y-3 text-sm leading-relaxed text-ink/80">{children}</div>
      </Panel>
    </motion.div>
  );
}

export function GuidePage() {
  const { t, list } = useI18n();
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 lg:px-6">
      <div className="mb-2">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-ink">{t('guide.title')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">{t('guide.intro')}</p>
      </div>

      <Step n={1} title={t('guide.step1')} icon={<FolderTree size={18} className="text-muted" />}>
        <p>{t('guide.step1text')}</p>
        {PATHS.map((p) => (
          <div key={p.os}>
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">{t(`guide.paths.${p.os}`)}</div>
            <CopyPath text={p.path} />
          </div>
        ))}
        <p className="text-[13px] text-muted">{t('guide.step1id')}</p>
        <Hint>{t('guide.step1onedrive')}</Hint>
      </Step>

      <Step n={2} title={t('guide.step2')} icon={<FolderTree size={18} className="text-muted" />}>
        <p>{t('guide.step2text')}</p>
        <pre className="overflow-x-auto rounded-lg border border-line bg-base p-3 font-mono text-[12px] text-ink/85">
{`UserSights/
├── all_tanks/
│   └── my_sight.blk
└── germ_flakpanzer_IV_Ostwind/
    └── ostwind_sight.blk`}
        </pre>
      </Step>

      <Step n={3} title={t('guide.step3')} icon={<FileDown size={18} className="text-muted" />}>
        <p>{t('guide.step3text')}</p>
      </Step>

      <Step n={4} title={t('guide.step4')} icon={<Gamepad2 size={18} className="text-muted" />}>
        <p>{t('guide.step4text')}</p>
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 font-mono text-[13px] text-ink">{t('guide.step4menu')}</div>
        <p className="text-[13px] text-muted">{t('guide.step4menuRu')}</p>
        <p>{t('guide.step4text2')}</p>
      </Step>

      <Step n={5} title={t('guide.step5')} icon={<CheckCircle2 size={18} className="text-muted" />}>
        <p>{t('guide.step5text')}</p>
        <Hint tone="warn">{t('export.needsGameCheck')}</Hint>
      </Step>

      <Panel className="p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-ink">
          <AlertCircle size={18} className="text-accent" /> {t('guide.troubleTitle')}
        </h2>
        <ul className="space-y-2 text-sm text-ink/80">
          {list('guide.trouble').map((s) => (
            <li key={s} className="flex gap-2">
              <ListChecks size={16} className="mt-0.5 shrink-0 text-accent/80" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-ink">
          <ShieldAlert size={18} className="text-accent" /> {t('guide.limitsTitle')}
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink/80">
          {list('export.limits').map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="mt-3 text-[13px] text-muted">
          {t('guide.honest')}{' '}
          <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
            GitHub Issues
          </a>
        </p>
      </Panel>

      <Panel className="p-5">
        <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide text-ink">{t('guide.sourcesTitle')}</h2>
        <ul className="space-y-1.5 text-sm">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-accent hover:underline">
                {s.label} <ExternalLink size={13} />
              </a>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
