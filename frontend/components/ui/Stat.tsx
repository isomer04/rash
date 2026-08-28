import type { ComponentPropsWithRef, ReactElement, ReactNode } from "react";
import { TrendDownIcon, TrendFlatIcon, TrendUpIcon } from "@/components/icons";
import { formatFigure, signTone } from "@/lib/format.mjs";
import { mergeClasses, variants } from "@/lib/cx.mjs";

export type StatSize = "sm" | "md" | "lg";
export type StatAlign = "start" | "end";
export type StatDeltaFormat = "percent" | "currency" | "plain";

export interface StatProps extends ComponentPropsWithRef<"div"> {
  label: string;
  value: ReactNode;
  delta?: number;
  deltaFormat?: StatDeltaFormat;
  hint?: string;
  size?: StatSize;
  align?: StatAlign;
}

const statClass = variants({
  base: "min-w-0",
  variants: {
    align: { start: "text-left", end: "text-right" },
  },
  defaults: { align: "start" },
});

const valueClass: Record<StatSize, string> = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
};

const deltaIcons = {
  "trend-up": TrendUpIcon,
  "trend-down": TrendDownIcon,
  "trend-flat": TrendFlatIcon,
};

export default function Stat({
  label,
  value,
  delta,
  deltaFormat = "plain",
  hint,
  size = "lg",
  align = "start",
  className,
  ...rest
}: StatProps): ReactElement {
  const presentation = delta === undefined ? null : signTone(delta);
  const DeltaIcon = presentation
    ? deltaIcons[presentation.icon as keyof typeof deltaIcons]
    : null;

  return (
    <div className={statClass({ align, className })} {...rest}>
      <p className="text-2xs uppercase text-text-muted">{label}</p>
      <div
        className={mergeClasses(
          "num mt-tight font-medium leading-none text-text",
          valueClass[size],
        )}
      >
        {value}
      </div>
      {presentation && DeltaIcon ? (
        <p
          className={mergeClasses(
            "num mt-snug inline-flex items-center gap-tight text-sm",
            presentation.className,
          )}
        >
          <DeltaIcon size={14} />
          <span>{formatFigure(delta, deltaFormat)}</span>
          <span className="sr-only">{presentation.label}</span>
        </p>
      ) : null}
      {hint ? <p className="mt-tight text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

export interface StatGridProps extends ComponentPropsWithRef<"div"> {
  columns?: 2 | 3 | 4;
}

const gridColumns: Record<NonNullable<StatGridProps["columns"]>, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function StatGrid({
  columns = 4,
  className,
  ...rest
}: StatGridProps): ReactElement {
  return (
    <div
      className={mergeClasses(
        "grid grid-cols-1 divide-y divide-border sm:divide-x sm:divide-y-0 [&>*]:p-base [&>*:first-child]:pl-0",
        gridColumns[columns],
        className,
      )}
      {...rest}
    />
  );
}
