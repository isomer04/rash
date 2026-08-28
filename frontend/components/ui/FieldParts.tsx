import { useId, type ReactElement } from "react";

export function useFieldIds({
  suppliedId,
  hint,
  error,
}: {
  suppliedId?: string;
  hint?: string;
  error?: string;
}) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return { id, hintId, errorId, describedBy };
}

export function FieldLabel({
  id,
  label,
  hidden,
}: {
  id: string;
  label: string;
  hidden?: boolean;
}): ReactElement {
  return (
    <label
      className={hidden ? "sr-only" : "mb-tight block text-sm font-medium text-text"}
      htmlFor={id}
    >
      {label}
    </label>
  );
}
