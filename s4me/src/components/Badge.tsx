interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
}

const variants = {
  default: 'bg-slate-100 text-slate-600',
  success: 'bg-accent-50 text-accent-700 border border-accent-100',
  warning: 'bg-warning-50 text-warning-700 border border-warning-100',
  error: 'bg-error-50 text-error-700 border border-error-100',
  info: 'bg-navy-50 text-navy-700 border border-navy-100',
};

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}
