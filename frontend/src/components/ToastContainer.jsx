import { useToastStore } from "../store/useToastStore.js";

const STYLES = {
  error: "border-danger/40 bg-danger/10 text-danger",
  success: "border-signal/40 bg-signal/10 text-signal",
};

const ToastContainer = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-xs">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`border rounded-lg px-3 py-2 text-sm font-mono flex items-start gap-2 shadow-lg backdrop-blur-sm ${
            STYLES[toast.type] || STYLES.error
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="opacity-60 hover:opacity-100 transition"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
