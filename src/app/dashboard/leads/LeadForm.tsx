'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { leadSchema, type LeadFormData } from '@/lib/schemas/lead';
import { FormField, TextareaField, SelectField } from '@/components/ui/FormField';

interface AccountOption { id: string; name: string; }

interface LeadFormProps {
  initialData?: Partial<LeadFormData>;
  onSubmit: (data: LeadFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  isEdit?: boolean;
}

const SOURCE_OPTIONS = [
  { label: 'Cold Call',    value: 'cold_call'    },
  { label: 'Cold Email',   value: 'cold_email'   },
  { label: 'LinkedIn',     value: 'linkedin'     },
  { label: 'Website',      value: 'website'      },
  { label: 'Referral',     value: 'referral'     },
  { label: 'Partner',      value: 'partner'      },
  { label: 'Direct Mail',  value: 'direct_mail'  },
  { label: 'Other',        value: 'other'        },
];

// Active pipeline stages (ordered funnel). Legacy values kept in DB but hidden from picker.
const STAGE_OPTIONS = [
  { label: 'New Lead',        value: 'new_lead'                 },
  { label: 'Contacted',       value: 'contacted'                },
  { label: 'Meeting Booked',  value: 'meeting_scheduled'        },
  { label: 'Meeting Done',    value: 'meeting_attended'         },
  { label: 'Quote Sent',      value: 'quote_delivered'          },
  { label: 'Negotiating',     value: 'negotiating'              },
  { label: 'Won',             value: 'won'                      },
  { label: 'On Hold',         value: 'contact_when_contract_up' },
  { label: 'Not Interested',  value: 'not_interested_for_now'   },
  { label: 'Dead',            value: 'foad'                     },
];

const MEETING_OUTCOME_OPTIONS = [
  { label: 'Good',           value: 'good'           },
  { label: 'Bad',            value: 'bad'            },
  { label: 'Not Interested', value: 'not_interested' },
];

const SECTOR_OPTIONS = [
  { label: 'Hospitality',               value: 'hospitality'           },
  { label: 'Automotive',                value: 'automotive'            },
  { label: 'Education',                 value: 'education'             },
  { label: 'Construction / Property',   value: 'construction_property' },
  { label: 'Healthcare',                value: 'healthcare'            },
  { label: 'Office / Professional',     value: 'office_professional'   },
  { label: 'Retail',                    value: 'retail'                },
  { label: 'Other',                     value: 'other'                 },
];

export function LeadForm({ initialData, onSubmit, onCancel, loading, isEdit }: LeadFormProps) {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      companyName:    initialData?.companyName    ?? '',
      contactName:    initialData?.contactName    ?? '',
      email:          initialData?.email          ?? '',
      phone:          initialData?.phone          ?? '',
      source:         initialData?.source         ?? '',
      stage:          initialData?.stage          ?? 'new_lead',
      meetingOutcome: initialData?.meetingOutcome ?? '',
      ownerId:        initialData?.ownerId        ?? '',
      contactId:      initialData?.contactId      ?? '',
      accountId:      initialData?.accountId      ?? '',
      notes:          initialData?.notes          ?? '',
      sector:         initialData?.sector         ?? '',
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
      <div className="grid grid-cols-2 gap-4">
        <Controller name="companyName" control={control} render={({ field }) => (
          <FormField label="Company Name" value={field.value} onChange={field.onChange}
            required error={errors.companyName?.message} placeholder="e.g. Acme Corp" />
        )} />
        <Controller name="contactName" control={control} render={({ field }) => (
          <FormField label="Contact Name" value={field.value} onChange={field.onChange}
            placeholder="e.g. John Smith" />
        )} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Controller name="email" control={control} render={({ field }) => (
          <FormField label="Email" type="email" value={field.value} onChange={field.onChange}
            error={errors.email?.message} placeholder="john@company.com" />
        )} />
        <Controller name="phone" control={control} render={({ field }) => (
          <FormField label="Phone" type="tel" value={field.value} onChange={field.onChange}
            placeholder="07123 456789" />
        )} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Controller name="source" control={control} render={({ field }) => (
          <SelectField label="Source" value={field.value} onChange={field.onChange}
            options={SOURCE_OPTIONS} required error={errors.source?.message}
            placeholder="Select source..." />
        )} />
        <Controller name="sector" control={control} render={({ field }) => (
          <SelectField label="Sector" value={field.value} onChange={field.onChange}
            options={SECTOR_OPTIONS} placeholder="Select sector..." />
        )} />
      </div>
      {isEdit && (
        <Controller name="stage" control={control} render={({ field }) => (
          <SelectField label="Stage" value={field.value} onChange={field.onChange}
            options={STAGE_OPTIONS} />
        )} />
      )}
      {currentStage === 'meeting_attended' && (
        <Controller name="meetingOutcome" control={control} render={({ field }) => (
          <SelectField label="Meeting Outcome" value={field.value} onChange={field.onChange}
            options={MEETING_OUTCOME_OPTIONS} placeholder="Select outcome..." />
        )} />
      )}
      <Controller name="accountId" control={control} render={({ field }) => (
        <SelectField label="Account" value={field.value} onChange={field.onChange}
          options={accounts.map((a) => ({ label: a.name, value: a.id }))}
          placeholder="Select an account..." />
      )} />
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
          {loading ? 'Saving...' : isEdit ? 'Update Lead' : 'Create Lead'}
        </button>
      </div>
    </form>
  );
}
