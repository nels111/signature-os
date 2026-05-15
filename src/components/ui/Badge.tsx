interface BadgeProps {
  label?: string;
  children?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  color?: string;
}

const variants: Record<string, { bg: string; color: string }> = {
  default: { bg: 'var(--background)', color: 'var(--text-muted)' },
  success: { bg: 'var(--status-success-bg)', color: 'var(--status-success)' },
  warning: { bg: 'var(--status-warning-bg)', color: 'var(--status-warning)' },
  danger: { bg: 'var(--status-danger-bg)', color: 'var(--status-danger)' },
  info: { bg: 'var(--status-info-bg)', color: 'var(--status-info)' },
};

export function Badge({ label, children, variant = 'default', color }: BadgeProps) {
  const style = color
    ? { bg: color.startsWith('var(') ? `color-mix(in srgb, ${color} 12%, transparent)` : color + '14', color }
    : variants[variant];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{
        backgroundColor: style.bg,
        color: style.color,
        letterSpacing: '0.01em',
      }}
    >
      {children || label}
    </span>
  );
}
