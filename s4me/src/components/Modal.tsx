import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full ${maxWidth} card max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-navy-900"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="max-w-md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className={danger ? 'btn-primary !bg-error-600 hover:!bg-error-700' : 'btn-primary'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}
