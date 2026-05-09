interface BadgeProps {
  label?: string;
  children?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  color?: string;
}

const variants: Record<string, { bg: string; color: string }> = {
  default: { bg: '#f1f5f9', color: '#64748b' },
  success: { bg: '#dcfce7', color: '#166534' },
  warning: { bg: '#fef9c3', color: '#854d0e' },
  danger: { bg: '#fce4e4', color: '#991b1b' },
  info: { bg: '#dbeafe', color: '#1e40af' },
};

export function Badge({ label, children, variant = 'default', color }: BadgeProps) {
  const style = color
    ? { bg: color + '20', color }
    : variants[variant];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {children || label}
    </span>
  );
}
