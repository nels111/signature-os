'use client';

import { useState, useEffect } from 'react';
import { FormField, TextareaField, SelectField } from '@/components/ui/FormField';

export interface LeadFormData {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  source: string;
  stage: string;
  meetingOutcome: string;
  ownerId: string;
  contactId: string;
  accountId: string;
  notes: string;
}

interface AccountOption {
  id: string;
  name: string;
}

interface LeadFormProps {
  initialData?: Partial<LeadFormData>;
  onSubmit: (data: LeadFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  isEdit?: boolean;
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

const STAGE_OPTIONS = [
  { label: 'Cold Call', value: 'cold_call' },
  { label: 'Cold Email', value: 'cold_email' },
  { label: 'Follow-up Sequence', value: 'follow_up_sequence' },
  { label: 'Meeting Scheduled', value: 'meeting_scheduled' },
  { label: 'Meeting Attended', value: 'meeting_attended' },
  { label: 'Quote Delivered', value: 'quote_delivered' },
];

const MEETING_OUTCOME_OPTIONS = [
  { label: 'Good', value: 'good' },
  { label: 'Bad', value: 'bad' },
  { label: 'Not Interested', value: 'not_interested' },
];

export function LeadForm({ initialData, onSubmit, onCancel, loading, isEdit }: LeadFormProps) {
  const [form, setForm] = useState<LeadFormData>({
    companyName: initialData?.companyName || '',
    contactName: initialData?.contactName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    source: initialData?.source || '',
    stage: initialData?.stage || 'cold_call',
    meetingOutcome: initialData?.meetingOutcome || '',
    ownerId: initialData?.ownerId || '',
    contactId: initialData?.contactId || '',
    accountId: initialData?.accountId || '',
    notes: initialData?.notes || '',
  });
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/accounts?limit=100&sortBy=name&sortDir=asc')
      .then((r) => r.json())
      .then((res) => setAccounts(res.data || []))
      .catch(() => {});
  }, []);

  const update = (field: keyof LeadFormData) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.companyName.trim()) newErrors.companyName = 'Company name is required';
    if (!form.contactName.trim()) newErrors.contactName = 'Contact name is required';
    if (!form.source) newErrors.source = 'Source is required';
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
          label="Company Name"
          value={form.companyName}
          onChange={update('companyName')}
          required
          error={errors.companyName}
          placeholder="e.g. Acme Corp"
        />
        <FormField
          label="Contact Name"
          value={form.contactName}
          onChange={update('contactName')}
          required
          error={errors.contactName}
          placeholder="e.g. John Smith"
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
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Source"
          value={form.source}
          onChange={update('source')}
          options={SOURCE_OPTIONS}
          required
          placeholder="Select source..."
        />
        {isEdit && (
          <SelectField
            label="Stage"
            value={form.stage}
            onChange={update('stage')}
            options={STAGE_OPTIONS}
          />
        )}
      </div>
      {form.stage === 'meeting_attended' && (
        <SelectField
          label="Meeting Outcome"
          value={form.meetingOutcome}
          onChange={update('meetingOutcome')}
          options={MEETING_OUTCOME_OPTIONS}
          placeholder="Select outcome..."
        />
      )}
      <SelectField
        label="Account"
        value={form.accountId}
        onChange={update('accountId')}
        options={accounts.map((a) => ({ label: a.name, value: a.id }))}
        placeholder="Select an account..."
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
          {loading ? 'Saving...' : isEdit ? 'Update Lead' : 'Create Lead'}
        </button>
      </div>
    </form>
  );
}
