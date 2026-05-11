'use client';

import { useState } from 'react';
import { FormField, TextareaField } from '@/components/ui/FormField';

export interface AccountFormData {
  name: string;
  industry: string;
  website: string;
  phone: string;
  address: string;
  notes: string;
}

interface AccountFormProps {
  initialData?: Partial<AccountFormData>;
  onSubmit: (data: AccountFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function AccountForm({ initialData, onSubmit, onCancel, loading }: AccountFormProps) {
  const [form, setForm] = useState<AccountFormData>({
    name: initialData?.name || '',
    industry: initialData?.industry || '',
    website: initialData?.website || '',
    phone: initialData?.phone || '',
    address: initialData?.address || '',
    notes: initialData?.notes || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: keyof AccountFormData) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Account name is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    await onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField
        label="Account Name"
        value={form.name}
        onChange={update('name')}
        required
        error={errors.name}
        placeholder="e.g. Acme Corp"
      />
      <FormField
        label="Industry"
        value={form.industry}
        onChange={update('industry')}
        placeholder="e.g. Commercial Cleaning"
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Website"
          type="url"
          value={form.website}
          onChange={update('website')}
          placeholder="https://example.com"
        />
        <FormField
          label="Phone"
          type="tel"
          value={form.phone}
          onChange={update('phone')}
          placeholder="07123 456789"
        />
      </div>
      <TextareaField
        label="Address"
        value={form.address}
        onChange={update('address')}
        placeholder="Full address..."
        rows={2}
      />
      <TextareaField
        label="Notes"
        value={form.notes}
        onChange={update('notes')}
        placeholder="Any additional notes..."
      />
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border rounded-lg hover:"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-blue)' }}
        >
          {loading ? 'Saving...' : 'Save Account'}
        </button>
      </div>
    </form>
  );
}
