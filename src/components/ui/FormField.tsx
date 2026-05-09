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

export function FormField({
  label, type = 'text', value, onChange, required, placeholder, error,
}: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a1a' }}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 ${
          error ? 'border-red-300 focus:ring-red-500' : 'focus:ring-green-600'
        }`}
        style={{ borderColor: error ? undefined : '#e2e8f0' }}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export function TextareaField({
  label, value, onChange, required, placeholder, rows = 3,
}: TextareaFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a1a' }}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
        style={{ borderColor: '#e2e8f0' }}
      />
    </div>
  );
}

export function SelectField({
  label, value, onChange, options, required, placeholder,
}: SelectFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a1a' }}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
        style={{ borderColor: '#e2e8f0' }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
