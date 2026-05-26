'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { contactSchema, type ContactFormData } from '@/lib/schemas/contact';
import { FormField, TextareaField, SelectField } from '@/components/ui/FormField';

interface AccountOption { id: string; name: string; }

interface ContactFormProps {
  initialData?: Partial<ContactFormData>;
  onSubmit: (data: ContactFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const SOURCE_OPTIONS = [
  { label: 'Cold Call',    value: 'cold_call'    },
  { label: 'Cold Email',   value: 'cold_email'   },
  { label: 'Referral',     value: 'referral'     },
  { label: 'Website',      value: 'website'      },
  { label: 'Mark Walker',  value: 'mark_walker'  },
  { label: 'Direct Mail',  value: 'direct_mail'  },
  { label: 'Other',        value: 'other'        },
];

export function ContactForm({ initialData, onSubmit, onCancel, loading }: ContactFormProps) {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  const { control, handleSubmit, formState: { errors } } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: initialData?.firstName ?? '',
      lastName:  initialData?.lastName  ?? '',
      email:     initialData?.email     ?? '',
      phone:     initialData?.phone     ?? '',
      company:   initialData?.company   ?? '',
      accountId: initialData?.accountId ?? '',
      notes:     initialData?.notes     ?? '',
      source:    initialData?.source    ?? '',
    },
  });

  useEffect(() => {
    fetch('/api/accounts?limit=100&sortBy=name&sortDir=asc')
      .then((r) => r.json())
      .then((res) => setAccounts(res.data || []))
      .catch(() => {});
  }, []);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Controller name="firstName" control={control} render={({ field }) => (
          <FormField label="First Name" value={field.value} onChange={field.onChange}
            required error={errors.firstName?.message} placeholder="e.g. John" />
        )} />
        <Controller name="lastName" control={control} render={({ field }) => (
          <FormField label="Last Name" value={field.value} onChange={field.onChange}
            required error={errors.lastName?.message} placeholder="e.g. Smith" />
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
      <Controller name="company" control={control} render={({ field }) => (
        <FormField label="Company" value={field.value} onChange={field.onChange}
          placeholder="Company name" />
      )} />
      <Controller name="accountId" control={control} render={({ field }) => (
        <SelectField label="Account" value={field.value} onChange={field.onChange}
          options={accounts.map((a) => ({ label: a.name, value: a.id }))}
          placeholder="Select an account..." />
      )} />
      <Controller name="source" control={control} render={({ field }) => (
        <SelectField label="Lead Source" value={field.value} onChange={field.onChange}
          options={SOURCE_OPTIONS} placeholder="Select source..." />
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
          {loading ? 'Saving...' : 'Save Contact'}
        </button>
      </div>
    </form>
  );
}
