import type { ReactNode } from 'react';
import type { Answer, GuideRef } from '../framework/types';

/** A link to a guide section. Opens in a new tab. */
export function Ref({ to, children }: { to: GuideRef; children?: ReactNode }) {
  return (
    <a className="ref" href={to.url} target="_blank" rel="noopener noreferrer">
      {children ?? `Guide: ${to.label}`} ↗
    </a>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | null;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function YesNo({ value, onChange, label }: { value: Answer; onChange: (v: Answer) => void; label: string }) {
  return (
    <Segmented<'yes' | 'no'>
      label={label}
      value={value === null ? null : value ? 'yes' : 'no'}
      options={[
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ]}
      onChange={(v) => onChange(v === 'yes')}
    />
  );
}

export function WeightPicker({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <Segmented<number>
      label={label}
      value={value}
      options={[0, 1, 2, 3].map((n) => ({ value: n, label: String(n), title: n === 0 ? 'Not an intent' : `Weight ${n}` }))}
      onChange={onChange}
    />
  );
}

export function WarningList({ items }: { items: { text: string; ref?: GuideRef; info?: boolean }[] }) {
  if (!items.length) return null;
  return (
    <ul className="warnings">
      {items.map((w, i) => (
        <li key={i}>
          <span className={`warn-icon${w.info ? ' info-icon' : ''}`} aria-hidden="true">
            {w.info ? 'i' : '!'}
          </span>
          <span>
            <span className="sr-only">{w.info ? 'Note: ' : 'Warning: '}</span>
            {w.text} {w.ref && <Ref to={w.ref}>more</Ref>}
          </span>
        </li>
      ))}
    </ul>
  );
}
