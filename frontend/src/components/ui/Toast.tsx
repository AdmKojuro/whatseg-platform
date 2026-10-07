import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

/* ---------- Types ---------- */

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (params: Omit<ToastItem, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
}

/* ---------- Context ---------- */

const ToastContext = createContext<ToastContextValue | null>(null);

function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

/* ---------- Visuals ---------- */

const iconMap: Record<ToastType, ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-emerald-500" />,
  error: <AlertCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
};

const borderColors: Record<ToastType, string> = {
  success: 'border-l-emerald-500',
  error: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-blue-500',
};

/* ---------- Single Toast ---------- */

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true));

    const duration = item.duration ?? 5000;
    timerRef.current = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onDismiss(item.id), 200);
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [item, onDismiss]);

  const handleClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
    setTimeout(() => onDismiss(item.id), 200);
  };

  return (
    <div
      className={`pointer-events-auto w-80 bg-white rounded-lg shadow-lg border border-gray-700 border-l-4 ${borderColors[item.type]} overflow-hidden transition-all duration-200 ${
        isVisible
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0'
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <span className="shrink-0 mt-0.5">{iconMap[item.type]}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{item.title}</p>
          {item.message && (
            <p className="mt-1 text-sm text-gray-500">{item.message}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------- Provider ---------- */

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((params: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { ...params, id }]);
  }, []);

  const success = useCallback(
    (title: string, message?: string) => addToast({ type: 'success', title, message }),
    [addToast],
  );
  const error = useCallback(
    (title: string, message?: string) => addToast({ type: 'error', title, message }),
    [addToast],
  );
  const warning = useCallback(
    (title: string, message?: string) => addToast({ type: 'warning', title, message }),
    [addToast],
  );
  const info = useCallback(
    (title: string, message?: string) => addToast({ type: 'info', title, message }),
    [addToast],
  );

  const value: ToastContextValue = {
    toast: addToast,
    success,
    error,
    warning,
    info,
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
          {toasts.map((t) => (
            <ToastCard key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export { ToastProvider, useToast, ToastContext };
export type { ToastType, ToastItem, ToastContextValue };
