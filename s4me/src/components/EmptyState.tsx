interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-navy-50 text-navy-500">
        {icon}
      </div>
      <h3 className="mb-1.5 text-base font-semibold text-navy-900">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-slate-500">{description}</p>
      {action}
    </div>
  );
}
