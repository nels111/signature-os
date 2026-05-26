'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { accountSchema, type AccountFormData } from '@/lib/schemas/account';
import { FormField, TextareaField } from '@/components/ui/FormField';

interface AccountFormProps {
  initialData?: Partial<AccountFormData>;
  onSubmit: (data: AccountFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function AccountForm({ initialData, onSubmit, onCancel, loading }: AccountFormProps) {
  const { control, handleSubmit, formState: { errors } } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name:     initialData?.name     ?? '',
      industry: initialData?.industry ?? '',
      website:  initialData?.website  ?? '',
      phone:    initialData?.phone    ?? '',
      address:  initialData?.address  ?? '',
      notes:    initialData?.notes    ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Controller name="name" control={control} render={({ field }) => (
        <FormField label="Account Name" value={field.value} onChange={field.onChange}
          required error={errors.name?.message} placeholder="e.g. Acme Corp" />
      )} />
      <Controller name="industry" control={control} render={({ field }) => (
        <FormField label="Industry" value={field.value} onChange={field.onChange}
          placeholder="e.g. Commercial Cleaning" />
      )} />
      <div className="grid grid-cols-2 gap-4">
        <Controller name="website" control={control} render={({ field }) => (
          <FormField label="Website" type="url" value={field.value} onChange={field.onChange}
            placeholder="https://example.com" />
        )} />
        <Controller name="phone" control={control} render={({ field }) => (
          <FormField label="Phone" type="tel" value={field.value} onChange={field.onChange}
            placeholder="07123 456789" />
        )} />
      </div>
      <Controller name="address" control={control} render={({ field }) => (
        <TextareaField label="Address" value={field.value} onChange={field.onChange}
          placeholder="Full address..." rows={2} />
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
          {loading ? 'Saving...' : 'Save Account'}
        </button>
      </div>
    </form>
  );
}
