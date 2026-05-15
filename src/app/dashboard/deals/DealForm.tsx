'use client';

import { useState, useEffect } from 'react';
import { FormField, TextareaField, SelectField } from '@/components/ui/FormField';

export interface DealFormData {
  name: string;
  stage: string;
  value: string;
  ownerId: string;
  contactId: string;
  accountId: string;
  notes: string;
  lossReason: string;
}

interface AccountOption {
  id: string;
  name: string;
}

interface DealFormProps {
  initialData?: Partial<DealFormData>;
  onSubmit: (data: DealFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  isEdit?: boolean;
}

const STAGE_OPTIONS = [
  { label: 'Quote Sent', value: 'quote_sent' },
  { label: 'Follow-up from Quote', value: 'follow_up_from_quote' },
  { label: 'Closed Won', value: 'closed_won' },
  { label: 'Closed Lost', value: 'closed_lost' },
];

export function DealForm({ initialData, onSubmit, onCancel, loading, isEdit }: DealFormProps) {
  const [form, setForm] = useState<DealFormData>({
    name: initialData?.name || '',
    stage: initialData?.stage || 'quote_sent',
    value: initialData?.value || '',
    ownerId: initialData?.ownerId || '',
    contactId: initialData?.contactId || '',
    accountId: initialData?.accountId || '',
    notes: initialData?.notes || '',
    lossReason: initialData?.lossReason || '',
  });
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/accounts?limit=100&sortBy=name&sortDir=asc')
      .then((r) => r.json())
      .then((res) => setAccounts(res.data || []))
      .catch(() => {});
  }, []);

  const update = (field: keyof DealFormData) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Deal name is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    await onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField
        label="Deal Name"
        value={form.name}
        onChange={update('name')}
        required
        error={errors.name}
        placeholder="e.g. Acme Corp - Office Cleaning"
      />
      {isEdit && (
        <SelectField
          label="Stage"
          value={form.stage}
          onChange={update('stage')}
          options={STAGE_OPTIONS}
        />
      )}
      <FormField
        label="Value (£)"
        type="number"
        value={form.value}
        onChange={update('value')}
        placeholder="e.g. 5000"
      />
      <SelectField
        label="Account"
        value={form.accountId}
        onChange={update('accountId')}
        options={accounts.map((a) => ({ label: a.name, value: a.id }))}
        placeholder="Select an account..."
      />
      {form.stage === 'closed_lost' && (
        <TextareaField
          label="Loss Reason"
          value={form.lossReason}
          onChange={update('lossReason')}
          placeholder="Why was this deal lost?"
        />
      )}
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
          {loading ? 'Saving...' : isEdit ? 'Update Deal' : 'Create Deal'}
        </button>
      </div>
    </form>
  );
}
