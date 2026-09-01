import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

const config: Record<AlertVariant, { icon: typeof Info; classes: string; iconClass: string }> = {
  info: { icon: Info, classes: 'bg-navy-50 border-navy-200', iconClass: 'text-navy-600' },
  success: { icon: CheckCircle, classes: 'bg-accent-50 border-accent-100', iconClass: 'text-accent-600' },
  warning: { icon: AlertTriangle, classes: 'bg-warning-50 border-warning-100', iconClass: 'text-warning-600' },
  error: { icon: XCircle, classes: 'bg-error-50 border-error-100', iconClass: 'text-error-600' },
};

export function Alert({ variant, title, children, action }: AlertProps) {
  const { icon: Icon, classes, iconClass } = config[variant];
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${classes}`}>
      <Icon size={20} className={`mt-0.5 shrink-0 ${iconClass}`} />
      <div className="flex-1">
        {title && <p className="text-sm font-semibold text-navy-900">{title}</p>}
        <div className="text-sm text-slate-600">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
