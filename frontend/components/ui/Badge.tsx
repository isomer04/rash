import type { ComponentPropsWithRef, ReactElement, ReactNode } from "react";
import { variants } from "@/lib/cx.mjs";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "agent"
  | "positive"
  | "negative"
  | "warning";
export type BadgeSize = "sm" | "md";

export const badgeClass = variants({
  base: "inline-flex w-fit items-center gap-tight rounded-xs border font-medium",
  variants: {
    tone: {
      neutral: "border-border bg-surface-sunken text-text-secondary",
      accent: "border-border-strong bg-accent-soft text-text",
      agent: "border-agent bg-agent-soft text-agent",
      positive: "border-positive bg-positive-soft text-positive",
      negative: "border-negative bg-negative-soft text-negative",
      warning: "border-warning bg-warning-soft text-warning",
    },
    size: {
      sm: "px-tight py-hair text-xs",
      md: "px-snug py-tight text-sm",
    },
  },
  defaults: { tone: "neutral", size: "sm" },
});

export interface BadgeProps extends ComponentPropsWithRef<"span"> {
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export default function Badge({
  tone = "neutral",
  size = "sm",
  dot = false,
  icon,
  children,
  className,
  ...rest
}: BadgeProps): ReactElement {
  return (
    <span className={badgeClass({ tone, size, className })} {...rest}>
      {dot ? (
        <span className="size-1.5 shrink-0 rounded-pill bg-current" aria-hidden="true" />
      ) : icon ? (
        <span className="inline-flex shrink-0" aria-hidden="true">{icon}</span>
      ) : null}
      {children}
    </span>
  );
}
