interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  multiline?: boolean;
}

export function TextField({ label, value, onChange, placeholder, id, multiline = false }: TextFieldProps) {
  const inputId = id ?? label.replace(/\s+/g, "-").toLowerCase();
  const sharedClassName =
    "w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-lg text-ink outline-none focus:border-brand";

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-ink-muted">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={inputId}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={sharedClassName}
        />
      ) : (
        <input
          id={inputId}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={sharedClassName}
        />
      )}
    </div>
  );
}
