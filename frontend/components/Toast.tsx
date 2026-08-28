import { useEffect, useState, type ComponentType, type ReactElement } from "react";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon, type IconProps } from "@/components/icons";
import { mergeClasses } from "@/lib/cx.mjs";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const presentation: Record<ToastMessage["type"], { classes: string; Icon: ComponentType<IconProps> }> = {
  success: { classes: "border-positive bg-positive-soft text-positive", Icon: CheckIcon },
  error: { classes: "border-negative bg-negative-soft text-negative", Icon: AlertIcon },
  info: { classes: "border-border-strong bg-accent-soft text-text", Icon: InfoIcon },
};

function Toast({ toast, onClose }: ToastProps): ReactElement {
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.id), toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const { classes, Icon } = presentation[toast.type];
  return (
    <div className={mergeClasses("flex items-center gap-snug rounded-lg border px-base py-snug shadow-float animate-slide-in", classes)} role="status">
      <Icon size={18} className="shrink-0" />
      <p className="flex-1 text-sm text-text">{toast.message}</p>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        aria-label="Dismiss notification"
        className="rounded-sm p-tight text-text-muted transition-colors duration-quick hover:bg-surface-sunken hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <CloseIcon size={16} />
      </button>
    </div>
  );
}

export function ToastContainer(): ReactElement | null {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  useEffect(() => {
    const handleToast = (event: CustomEvent<Omit<ToastMessage, "id">>) => {
      setToasts((previous) => [...previous, { ...event.detail, id: crypto.randomUUID() }]);
    };
    window.addEventListener("toast", handleToast as EventListener);
    return () => window.removeEventListener("toast", handleToast as EventListener);
  }, []);
  const removeToast = (id: string) => setToasts((previous) => previous.filter((toast) => toast.id !== id));
  if (toasts.length === 0) return null;
  return (
    <div className="fixed right-base top-base z-50 w-[min(24rem,calc(100vw-2rem))] space-y-snug">
      {toasts.map((toast) => <Toast key={toast.id} toast={toast} onClose={removeToast} />)}
    </div>
  );
}

export function showToast(type: ToastMessage["type"], message: string, duration?: number): void {
  window.dispatchEvent(new CustomEvent("toast", { detail: { type, message, duration } }));
}
