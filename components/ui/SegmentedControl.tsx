interface SegmentedControlProps<T extends string | number> {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  formatOption?: (value: T) => string;
  columns?: 2 | 4;
}

/** Large tappable segment buttons - used for Direction, Control Line, Sand Volume. */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  formatOption,
  columns = 4,
}: SegmentedControlProps<T>) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold text-ink-muted">{label}</span>
      <div className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={String(option)}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={selected}
              className={`min-h-14 rounded-xl border-2 px-3 text-lg font-semibold transition-colors ${
                selected
                  ? "border-brand bg-brand text-brand-contrast"
                  : "border-border bg-surface text-ink active:bg-neutral-bg"
              }`}
            >
              {formatOption ? formatOption(option) : String(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
