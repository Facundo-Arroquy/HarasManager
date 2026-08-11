import { CheckCircle2, XCircle, X } from 'lucide-react'
import { useToastStore } from '../../store/toastStore'

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const dismissToast = useToastStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 shadow-lg text-sm ${
            t.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {t.type === 'success' ? (
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          ) : (
            <XCircle size={16} className="shrink-0 mt-0.5" />
          )}
          <p className="flex-1 min-w-0">{t.message}</p>
          <button
            onClick={() => dismissToast(t.id)}
            className="shrink-0 opacity-60 hover:opacity-100"
            title="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
