'use client';

// Click-to-call / click-to-email links. Phone numbers dial via tel:, emails
// open the mail client via mailto:. Used across lead/contact detail views.

function telHref(phone: string): string {
  // Keep leading + and digits only for the tel: target.
  return 'tel:' + phone.replace(/[^\d+]/g, '');
}

export function PhoneLink({ phone, className, style }: {
  phone: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!phone) return <span className={className} style={style}>—</span>;
  return (
    <a href={telHref(phone)} className={className ?? 'text-sm hover:underline'} style={style ?? { color: 'var(--brand-blue)' }}>
      {phone}
    </a>
  );
}

export function EmailLink({ email, className, style }: {
  email: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!email) return <span className={className} style={style}>—</span>;
  return (
    <a href={`mailto:${email}`} className={className ?? 'text-sm hover:underline'} style={style ?? { color: 'var(--brand-blue)' }}>
      {email}
    </a>
  );
}
