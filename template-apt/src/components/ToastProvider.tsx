import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  X as CloseIcon,
} from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  type?: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, 'duration'>> {
  id: string;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, JSX.Element> = {
  success: <CheckCircle2 size={18} />,
  error: <AlertOctagon size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'border-emerald-500 bg-emerald-50 text-emerald-800',
  error: 'border-rose-500 bg-rose-50 text-rose-800',
  warning: 'border-amber-500 bg-amber-50 text-amber-800',
  info: 'border-blue-500 bg-blue-50 text-blue-800',
};

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Record<string, number>>({});

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timeoutId = timeoutsRef.current[id];
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      delete timeoutsRef.current[id];
    }
  }, []);

  const showToast = useCallback(
    ({ type = 'info', title, message, duration = 4000 }: ToastOptions) => {
      if (!message) return;

      const id = generateId();
      setToasts((prev) => [...prev, { id, type, title, message }]);

      if (duration > 0) {
        const timeoutId = window.setTimeout(() => removeToast(id), duration);
        timeoutsRef.current[id] = timeoutId;
      }
    },
    [removeToast],
  );

  const contextValue = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex w-full max-w-md flex-col gap-3 px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`flex items-start gap-3 rounded-xl border-l-4 bg-white/95 p-4 shadow-lg shadow-slate-300/40 backdrop-blur ${TYPE_STYLES[toast.type]}`}
          >
            <span className="mt-1">{ICONS[toast.type]}</span>
            <div className="flex-1">
              {toast.title && (
                <p className="text-sm font-semibold">{toast.title}</p>
              )}
              <p className="text-sm leading-relaxed">{toast.message}</p>
            </div>
            <button
              type="button"
              aria-label="Cerrar notificación"
              onClick={() => removeToast(toast.id)}
              className="rounded-full p-1 transition hover:bg-white/60"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast debe usarse dentro de un ToastProvider');
  }
  return ctx;
};


