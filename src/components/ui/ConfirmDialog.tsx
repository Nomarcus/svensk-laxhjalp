import { useTranslation } from 'react-i18next';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { cn } from '../../utils/cn';

interface ConfirmDialogProps {
  open: boolean;
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  message,
  title,
  confirmLabel,
  cancelLabel,
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const containerRef = useDialogA11y<HTMLDivElement>(open, onCancel);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-message"
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full border border-black/10 dark:border-white/10 p-6 outline-none"
      >
        {title && <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">{title}</h2>}
        <p id="confirm-dialog-message" className="text-sm text-stone-600 dark:text-stone-300">
          {message}
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 dark:focus-visible:ring-emerald-800"
          >
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
              destructive
                ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-300 dark:focus-visible:ring-red-800'
                : 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-300 dark:focus-visible:ring-emerald-800',
            )}
          >
            {confirmLabel || t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
