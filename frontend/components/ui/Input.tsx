import type { ComponentPropsWithRef, ReactElement, ReactNode } from "react";
import { mergeClasses } from "@/lib/cx.mjs";
import { FieldLabel, useFieldIds } from "@/components/ui/FieldParts";

export interface InputProps
  extends Omit<ComponentPropsWithRef<"input">, "size"> {
  label: string;
  labelHidden?: boolean;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  inputSize?: "sm" | "md";
  numeric?: boolean;
}

export default function Input({
  label,
  labelHidden = false,
  hint,
  error,
  leadingIcon,
  trailingSlot,
  inputSize = "md",
  numeric = false,
  id: suppliedId,
  className,
  inputMode,
  ...rest
}: InputProps): ReactElement {
  const { id, hintId, errorId, describedBy } = useFieldIds({ suppliedId, hint, error });

  return (
    <div className="w-full">
      <FieldLabel id={id} label={label} hidden={labelHidden} />
      <div className="relative flex items-center">
        {leadingIcon ? <span className="pointer-events-none absolute left-snug inline-flex text-text-muted">{leadingIcon}</span> : null}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          inputMode={numeric ? "decimal" : inputMode}
          className={mergeClasses(
            "w-full rounded-sm border border-border-strong bg-surface-raised px-snug text-text outline-none placeholder:text-text-muted focus:border-focus focus:outline-2 focus:outline-offset-2 focus:outline-focus disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:text-text-muted",
            inputSize === "sm" ? "h-7 text-sm" : "h-8 text-base",
            leadingIcon ? "pl-8" : "",
            trailingSlot ? "pr-10" : "",
            numeric ? "num-left" : "",
            error ? "border-negative" : "",
            className,
          )}
          {...rest}
        />
        {trailingSlot ? <span className="absolute right-snug inline-flex text-text-secondary">{trailingSlot}</span> : null}
      </div>
      {error ? <p id={errorId} className="mt-tight text-xs text-negative">{error}</p> : null}
      {hint ? <p id={hintId} className="mt-tight text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

export const Field = Input;
