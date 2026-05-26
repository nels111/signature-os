'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { dealSchema, type DealFormData } from '@/lib/schemas/deal';
import { FormField, TextareaField, SelectField } from '@/components/ui/FormField';

interface AccountOption { id: string; name: string; }

interface DealFormProps {
  initialData?: Partial<DealFormData>;
  onSubmit: (data: DealFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  isEdit?: boolean;
}

const STAGE_OPTIONS = [
  { label: 'Quote Sent',          value: 'quote_sent'          },
  { label: 'Follow-up from Quote',value: 'follow_up_from_quote'},
  { label: 'Closed Won',          value: 'closed_won'          },
  { label: 'Closed Lost',         value: 'closed_lost'         },
];

const SECTOR_OPTIONS = [
  { label: 'Hospitality',             value: 'hospitality'           },
  { label: 'Automotive',              value: 'automotive'            },
  { label: 'Education',               value: 'education'             },
  { label: 'Construction / Property', value: 'construction_property' },
  { label: 'Healthcare',              value: 'healthcare'            },
  { label: 'Office / Professional',   value: 'office_professional'   },
  { label: 'Retail',                  value: 'retail'                },
  { label: 'Other',                   value: 'other'                 },
];

const inputStyle = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-primary)',
};

export function DealForm({ initialData, onSubmit, onCancel, loading, isEdit }: DealFormProps) {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<DealFormData>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      name:        initialData?.name        ?? '',
      stage:       initialData?.stage       ?? 'quote_sent',
      value:       initialData?.value       ?? '',
      ownerId:     initialData?.ownerId     ?? '',
      contactId:   initialData?.contactId   ?? '',
      accountId:   initialData?.accountId   ?? '',
      notes:       initialData?.notes       ?? '',
      lossReason:  initialData?.lossReason  ?? '',
      sector:      initialData?.sector      ?? '',
      closingDate: initialData?.closingDate ?? '',
      probability: initialData?.probability ?? '',
    },
  });

  const currentStage = watch('stage');

  useEffect(() => {
    fetch('/api/accounts?limit=100&sortBy=name&sortDir=asc')
      .then((r) => r.json())
      .then((res) => setAccounts(res.data || []))
      .catch(() => {});
  }, []);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Controller name="name" control={control} render={({ field }) => (
        <FormField label="Deal Name" value={field.value} onChange={field.onChange}
          required error={errors.name?.message} placeholder="e.g. Acme Corp - Office Cleaning" />
      )} />
      {isEdit && (
        <Controller name="stage" control={control} render={({ field }) => (
          <SelectField label="Stage" value={field.value} onChange={field.onChange}
            options={STAGE_OPTIONS} />
        )} />
      )}
      <div className="grid grid-cols-2 gap-4">
        <Controller name="value" control={control} render={({ field }) => (
          <FormField label="Value (£/month)" type="number" value={field.value}
            onChange={field.onChange} placeholder="e.g. 2500" />
        )} />
        <Controller name="sector" control={control} render={({ field }) => (
          <SelectField label="Sector" value={field.value} onChange={field.onChange}
            options={SECTOR_OPTIONS} placeholder="Select sector..." />
        )} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase mb-1.5"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            Expected Close Date
          </label>
          <Controller name="closingDate" control={control} render={({ field }) => (
            <input type="date" value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg focus-brand"
              style={inputStyle} />
          )} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase mb-1.5"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            Probability (%)
          </label>
          <Controller name="probability" control={control} render={({ field }) => (
            <input type="number" min={0} max={100} value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              placeholder="e.g. 70"
              className="w-full px-3 py-2 text-sm border rounded-lg focus-brand"
              style={inputStyle} />
          )} />
        </div>
      </div>
      <Controller name="accountId" control={control} render={({ field }) => (
        <SelectField label="Account" value={field.value} onChange={field.onChange}
          options={accounts.map((a) => ({ label: a.name, value: a.id }))}
          placeholder="Select an account..." />
      )} />
      {currentStage === 'closed_lost' && (
        <Controller name="lossReason" control={control} render={({ field }) => (
          <TextareaField label="Loss Reason" value={field.value} onChange={field.onChange}
            placeholder="Why was this deal lost?" />
        )} />
      )}
      <Controller name="notes" control={control} render={({ field }) => (
        <TextareaField label="Notes" value={field.value} onChange={field.onChange}
          placeholder="Any additional notes..." />
      )} />
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-blue)' }}>
          {loading ? 'Saving...' : isEdit ? 'Update Deal' : 'Create Deal'}
        </button>
      </div>
    </form>
  );
}
