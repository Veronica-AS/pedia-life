import { useId } from 'react';

export interface Option<T extends string> {
  value: T;
  label: string;
  description?: string;
  extra?: React.ReactNode;
}

/** Grupo de opciones accesible (radio buttons nativos con aspecto de botones) */
export function OptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 3,
  name,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  columns?: 1 | 2 | 3 | 4;
  name?: string;
}) {
  const id = useId();
  const cols = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }[columns];
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className={`grid gap-2 ${cols}`}>
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={o.value}
              className={`relative flex min-h-[44px] cursor-pointer flex-col justify-center rounded-xl border px-3 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 ${
                checked
                  ? 'border-brand-600 bg-brand-50 text-brand-900 dark:border-brand-400 dark:bg-brand-950/50 dark:text-brand-100'
                  : 'border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                name={name ?? id}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
              />
              <span className="font-semibold">{o.label}</span>
              {o.description && <span className="mt-0.5 text-xs opacity-80">{o.description}</span>}
              {o.extra}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
