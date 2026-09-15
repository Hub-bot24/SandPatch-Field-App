interface NumericFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  unit?: string;
  error?: string;
  placeholder?: string;
  allowNegative?: boolean;
  size?: "default" | "large";
  id?: string;
  autoFocus?: boolean;
}

function sanitizeNumericInput(raw: string, allowNegative: boolean): string {
  let value = raw.replace(allowNegative ? /[^0-9.-]/g : /[^0-9.]/g, "");

  if (allowNegative) {
    const isNegative = value.startsWith("-");
    value = value.replace(/-/g, "");
    if (isNegative) value = `-${value}`;
  }

  const firstDot = value.indexOf(".");
  if (firstDot !== -1) {
    value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, "");
  }

  return value;
}

/**
 * Large, numeric-keyboard text field. Uses `inputMode="decimal"` on a text
 * input rather than `<input type="number">` so a value like "27.080" is
 * never silently mangled (native number inputs strip trailing zeros while
 * the field is live) - see the chainage formatting requirement.
 */
export function NumericField({
  label,
  value,
  onChange,
  onBlur,
  unit,
  error,
  placeholder,
  allowNegative = false,
  size = "default",
  id,
  autoFocus,
}: NumericFieldProps) {
  const inputId = id ?? label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-ink-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(sanitizeNumericInput(e.target.value, allowNegative))}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          className={`w-full rounded-xl border-2 bg-surface px-4 font-mono tabular-nums text-ink outline-none ${
            size === "large" ? "py-5 text-4xl" : "py-3 text-xl"
          } ${error ? "border-poor" : "border-border focus:border-brand"}`}
        />
        {unit && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted">
            {unit}
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-sm font-medium text-poor">{error}</p>}
    </div>
  );
}
