'use client';

import { useState, useEffect } from 'react';
import { FormField, TextareaField, SelectField } from '@/components/ui/FormField';

export interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  accountId: string;
  notes: string;
  source: string;
}

interface AccountOption {
  id: string;
  name: string;
}

interface ContactFormProps {
  initialData?: Partial<ContactFormData>;
  onSubmit: (data: ContactFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const SOURCE_OPTIONS = [
  { label: 'Cold Call', value: 'cold_call' },
  { label: 'Cold Email', value: 'cold_email' },
  { label: 'Referral', value: 'referral' },
  { label: 'Website', value: 'website' },
  { label: 'Mark Walker', value: 'mark_walker' },
  { label: 'Direct Mail', value: 'direct_mail' },
  { label: 'Other', value: 'other' },
];

export function ContactForm({ initialData, onSubmit, onCancel, loading }: ContactFormProps) {
  const [form, setForm] = useState<ContactFormData>({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    company: initialData?.company || '',
    accountId: initialData?.accountId || '',
    notes: initialData?.notes || '',
    source: initialData?.source || '',
  });
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/accounts?limit=100&sortBy=name&sortDir=asc')
      .then((r) => r.json())
      .then((res) => setAccounts(res.data || []))
      .catch(() => {});
  }, []);

  const update = (field: keyof ContactFormData) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!form.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    await onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="First Name"
          value={form.firstName}
          onChange={update('firstName')}
          required
          error={errors.firstName}
          placeholder="e.g. John"
        />
        <FormField
          label="Last Name"
          value={form.lastName}
          onChange={update('lastName')}
          required
          error={errors.lastName}
          placeholder="e.g. Smith"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Email"
          type="email"
          value={form.email}
          onChange={update('email')}
          placeholder="john@company.com"
        />
        <FormField
          label="Phone"
          type="tel"
          value={form.phone}
          onChange={update('phone')}
          placeholder="07123 456789"
        />
      </div>
      <FormField
        label="Company"
        value={form.company}
        onChange={update('company')}
        placeholder="Company name"
      />
      <SelectField
        label="Account"
        value={form.accountId}
        onChange={update('accountId')}
        options={accounts.map((a) => ({ label: a.name, value: a.id }))}
        placeholder="Select an account..."
      />
      <SelectField
        label="Lead Source"
        value={form.source}
        onChange={update('source')}
        options={SOURCE_OPTIONS}
        placeholder="Select source..."
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
          className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
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
          {loading ? 'Saving...' : 'Save Contact'}
        </button>
      </div>
    </form>
  );
}
