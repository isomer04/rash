import type { ComponentPropsWithRef, ReactElement } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { mergeClasses } from "@/lib/cx.mjs";
import { FieldLabel, useFieldIds } from "@/components/ui/FieldParts";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export interface SelectProps
  extends Omit<ComponentPropsWithRef<"select">, "children" | "size"> {
  label: string;
  labelHidden?: boolean;
  options: ReadonlyArray<SelectOption>;
  placeholder?: string;
  hint?: string;
  error?: string;
  selectSize?: "sm" | "md";
}

export default function Select({
  label,
  labelHidden = false,
  options,
  placeholder,
  hint,
  error,
  selectSize = "md",
  id: suppliedId,
  className,
  value,
  defaultValue,
  ...rest
}: SelectProps): ReactElement {
  const { id, hintId, errorId, describedBy } = useFieldIds({ suppliedId, hint, error });
  const initialValue = value === undefined && defaultValue === undefined && placeholder
    ? ""
    : defaultValue;

  return (
    <div className="w-full">
      <FieldLabel id={id} label={label} hidden={labelHidden} />
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={value}
          defaultValue={initialValue}
          className={mergeClasses(
            "w-full appearance-none rounded-sm border border-border-strong bg-surface-raised px-snug pr-8 text-text outline-none focus:border-focus focus:outline-2 focus:outline-offset-2 focus:outline-focus disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:text-text-muted",
            selectSize === "sm" ? "h-7 text-sm" : "h-8 text-base",
            error ? "border-negative" : "",
            className,
          )}
          {...rest}
        >
          {placeholder ? <option value="" disabled>{placeholder}</option> : null}
          {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
        </select>
        <ChevronDownIcon size={16} className="pointer-events-none absolute right-snug top-1/2 -translate-y-1/2 text-text-muted" />
      </div>
      {error ? <p id={errorId} className="mt-tight text-xs text-negative">{error}</p> : null}
      {hint ? <p id={hintId} className="mt-tight text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}
