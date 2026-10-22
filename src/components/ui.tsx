import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-line bg-panel/90 shadow-[0_10px_40px_-20px_rgba(0,0,0,.8)]', className)}>{children}</div>;
}

export function Section({
  title,
  icon,
  children,
  defaultOpen = true,
  right,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  right?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line/70 last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left font-display text-[15px] font-semibold uppercase tracking-wider text-ink/90 hover:text-ink"
          aria-expanded={open}
        >
          {icon && <span className="text-accent">{icon}</span>}
          <span className="truncate">{title}</span>
          <ChevronDown size={16} className={cx('ml-auto shrink-0 text-muted transition-transform', open && 'rotate-180')} />
        </button>
        {right}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Toggle({ checked, onChange, label, small }: { checked: boolean; onChange: (v: boolean) => void; label?: string; small?: boolean }) {
  return (
    <label className={cx('flex cursor-pointer select-none items-center gap-2.5', small ? 'text-xs' : 'text-sm', 'text-ink/85')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
          checked ? 'border-accent bg-accent/90' : 'border-line bg-base',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 35 }}
          className={cx('absolute h-3.5 w-3.5 rounded-full', checked ? 'right-0.5 bg-white' : 'left-0.5 bg-muted')}
        />
      </button>
      {label && <span>{label}</span>}
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  hint,
  digits,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  hint?: string;
  digits?: number;
}) {
  const id = useId();
  const d = digits ?? (step < 0.1 ? 2 : step < 1 ? 1 : 0);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs text-muted">
          {label}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={Number(value.toFixed(d))}
            step={step}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) onChange(v);
            }}
            className="w-[4.5rem] rounded-md border border-line bg-base px-1.5 py-0.5 text-right font-mono text-xs text-ink outline-none focus:border-accent"
          />
          {unit && <span className="w-7 text-[11px] text-muted">{unit}</span>}
        </div>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="wt-range w-full" />
      {hint && <p className="mt-1 text-[11px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

export function NumberField({ label, value, onChange, step = 1, unit }: { label: string; value: number; onChange: (v: number) => void; step?: number; unit?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v)) onChange(v);
          }}
          className="w-full min-w-0 rounded-md border border-line bg-base px-2 py-1 font-mono text-xs text-ink outline-none focus:border-accent"
        />
        {unit && <span className="text-[11px] text-muted">{unit}</span>}
      </div>
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  invalid,
  mono,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  mono?: boolean;
}) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs text-muted">{label}</span>}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cx(
          'w-full rounded-lg border bg-base px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/60',
          mono && 'font-mono',
          invalid ? 'border-red-500/80 focus:border-red-400' : 'border-line focus:border-accent',
        )}
      />
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md' }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-base p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'relative flex-1 whitespace-nowrap rounded-md font-medium transition-colors',
            size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs',
            value === o.value ? 'text-white' : 'text-muted hover:text-ink',
          )}
        >
          {value === o.value && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 rounded-md bg-accent/90" transition={{ duration: 0.15 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string>({ label, value, options, onChange }: { label?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs text-muted">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-lg border border-line bg-base px-2.5 py-2 text-sm text-ink outline-none focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const hex = (c: number[]) => '#' + c.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export const COLOR_PRESETS: [number, number, number][] = [
  [255, 107, 53],
  [31, 239, 31],
  [255, 30, 30],
  [0, 0, 0],
  [255, 255, 255],
  [0, 229, 255],
  [255, 214, 0],
];

export function ColorField({ label, value, onChange }: { label: string; value: [number, number, number, number]; onChange: (v: [number, number, number, number]) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="relative h-8 w-11 cursor-pointer overflow-hidden rounded-md border border-line" style={{ background: hex(value) }}>
          <input
            type="color"
            value={hex(value)}
            onChange={(e) => onChange([...fromHex(e.target.value), value[3]] as [number, number, number, number])}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={label}
          />
        </label>
        {COLOR_PRESETS.map((c) => (
          <button
            key={c.join()}
            type="button"
            aria-label={hex(c)}
            onClick={() => onChange([...c, value[3]] as [number, number, number, number])}
            className={cx('h-6 w-6 rounded-md border transition-transform hover:scale-110', hex(c) === hex(value) ? 'border-white' : 'border-line')}
            style={{ background: hex(c) }}
          />
        ))}
        <span className="ml-auto font-mono text-[11px] text-muted">{value.join(', ')}</span>
      </div>
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'outline' | 'danger'; size?: 'sm' | 'md' };
export function Button({ variant = 'outline', size = 'md', className, children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all active:scale-[.97] disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        variant === 'primary' && 'bg-accent text-white shadow-glow hover:bg-accent2',
        variant === 'outline' && 'border border-line bg-panel2 text-ink/90 hover:border-accent/60 hover:text-ink',
        variant === 'ghost' && 'text-muted hover:bg-panel2 hover:text-ink',
        variant === 'danger' && 'border border-red-500/40 text-red-300 hover:bg-red-500/10',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Hint({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'error' | 'ok' }) {
  return (
    <div
      className={cx(
        'rounded-lg border px-3 py-2 text-[12px] leading-snug',
        tone === 'info' && 'border-line bg-base/60 text-muted',
        tone === 'warn' && 'border-amber-500/40 bg-amber-500/10 text-amber-200',
        tone === 'error' && 'border-red-500/40 bg-red-500/10 text-red-200',
        tone === 'ok' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
      )}
    >
      {children}
    </div>
  );
}

export { cx };
