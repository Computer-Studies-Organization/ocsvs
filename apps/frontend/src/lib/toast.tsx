import { CheckCircle2, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

type ToastType = 'success' | 'error'

type ToastMessage = {
  message: string
  type: ToastType
  duration?: number
}

type ToastContextValue = {
  showToast: (toast: ToastMessage) => void
}

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
}

const ToastContext = createContext<ToastContextValue | null>(null)

function ToastComponent({ message, type, onDismiss }: { message: string; type: ToastType; onDismiss: () => void }) {
  const Icon = type === 'success' ? CheckCircle2 : XCircle
  const iconColor = type === 'success' ? 'oklch(0.70 0.12 140)' : 'oklch(0.70 0.12 30)'

  return (
    <div
      className="fixed z-50 bottom-4 right-4 rounded-xl px-6 py-4 text-sm font-bold shadow-2xl transition-all duration-300 border-2 flex items-center gap-3"
      style={{
        background: type === 'success' ? 'oklch(0.30 0.04 140)' : 'oklch(0.30 0.04 30)',
        borderColor: type === 'success' ? 'oklch(0.50 0.10 140)' : 'oklch(0.50 0.10 30)',
        color: 'oklch(0.98 0.005 250)',
      }}
    >
      <Icon size={20} strokeWidth={2.5} style={{ color: iconColor, flexShrink: 0 }} />
      <span>{message}</span>
      <button
        onClick={onDismiss}
        className="ml-2 p-1 rounded-lg transition-colors flex-shrink-0"
        style={{ color: 'oklch(0.60 0.015 250)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'oklch(0.95 0.008 250)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'oklch(0.60 0.015 250)' }}
      >
        <X size={16} strokeWidth={2.5} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const showToast = useCallback((t: ToastMessage) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    setToast(t)
    const duration = t.duration ?? DEFAULT_DURATIONS[t.type]
    timerRef.current = setTimeout(() => {
      setToast(null)
    }, duration)
  }, [])

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    setToast(null)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <ToastComponent
          message={toast.message}
          type={toast.type}
          onDismiss={dismiss}
        />
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}
