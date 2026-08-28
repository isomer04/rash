import { useEffect, useRef, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { Button, Card } from "@/components/ui";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonClass = "",
  onConfirm,
  onCancel,
  isProcessing = false,
}: ConfirmModalProps): ReactElement | null {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const processingRef = useRef(isProcessing);
  onCancelRef.current = onCancel;
  processingRef.current = isProcessing;

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    focusable()[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !processingRef.current) onCancelRef.current();
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;
  const handleScrimClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !isProcessing) onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay p-base" onMouseDown={handleScrimClick} role="presentation">
      <Card ref={dialogRef} tabIndex={-1} className="w-full max-w-md rounded-lg shadow-overlay" padding="loose" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
        <h3 id="confirm-modal-title" className="text-xl font-medium text-text">{title}</h3>
        <div className="mb-loose mt-base text-base text-text-secondary">{message}</div>
        <div className="flex gap-snug">
          <Button variant="ghost" fullWidth onClick={onCancel} disabled={isProcessing}>{cancelText}</Button>
          <Button variant="danger" fullWidth onClick={onConfirm} loading={isProcessing} className={confirmButtonClass}>
            {isProcessing ? "Processing..." : confirmText}
          </Button>
        </div>
      </Card>
    </div>
  );
}
