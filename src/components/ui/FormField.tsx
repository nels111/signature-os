interface FormFieldProps {
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'datetime-local' | 'tel' | 'url';
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
}

interface TextareaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  rows?: number;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  required?: boolean;
  placeholder?: string;
}

const inputStyle = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  borderRadius: 'var(--radius-sm)',
};

// Use the .focus-brand utility from globals.css so the focus ring tracks
// --brand-blue. Avoid hard-coding hex values here: design-system tokens
// only.
const inputFocusClass = 'w-full px-3 py-2 text-sm focus-brand transition-shadow';

export function FormField({
  label, type = 'text', value, onChange, required, placeholder, error,
}: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
        {label} {required && <span style={{ color: 'var(--status-danger)' }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className={inputFocusClass}
        style={{
          ...inputStyle,
          ...(error ? { borderColor: 'var(--status-danger)' } : {}),
        }}
      />
      {error && (
        <p className="text-xs mt-1" style={{ color: 'var(--status-danger)' }}>{error}</p>
      )}
    </div>
  );
}

export function TextareaField({
  label, value, onChange, required, placeholder, rows = 3,
}: TextareaFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
        {label} {required && <span style={{ color: 'var(--status-danger)' }}>*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        rows={rows}
        className={inputFocusClass}
        style={inputStyle}
      />
    </div>
  );
}

export function SelectField({
  label, value, onChange, options, required, placeholder,
}: SelectFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
        {label} {required && <span style={{ color: 'var(--status-danger)' }}>*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={inputFocusClass}
        style={inputStyle}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
