'use client';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  details?: { label: string; value: string | number }[];
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  details,
  warning,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  danger = false,
  disabled = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white rounded shadow-lg max-w-sm w-full p-5">
        <h2 className="text-lg font-semibold mb-3">{title}</h2>
        {details && details.length > 0 && (
          <ul className="text-sm text-slate-700 space-y-1 mb-3">
            {details.map((d) => (
              <li key={d.label} className="flex justify-between">
                <span>{d.label}</span>
                <span className="font-medium">{d.value}</span>
              </li>
            ))}
          </ul>
        )}
        {warning && <p className="text-sm text-red-600 mb-4">{warning}</p>}
        {children}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1 rounded border text-sm">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={disabled}
            className={`px-3 py-1 rounded text-sm text-white disabled:opacity-50 ${danger ? 'bg-red-600' : 'bg-slate-900'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
