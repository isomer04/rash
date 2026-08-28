import type { ComponentPropsWithRef, ReactElement, ReactNode } from "react";
import { SpinnerIcon } from "@/components/icons";
import { variants } from "@/lib/cx.mjs";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "agent";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * The button recipe, exported so a `next/link` can be styled as a button without
 * introducing a polymorphic `as` prop:
 *
 * ```tsx
 * <Link href="/dashboard" className={buttonClass({ variant: "primary" })}>…</Link>
 * ```
 *
 * `primary` is the maximum-contrast surface rather than a coloured one: the
 * accent resolves to ink on light and to paper on dark, so the chosen action is
 * found by weight, not by hue. All saturation is reserved for meaning, which is
 * why only `danger` and `agent` carry a hue.
 */
export const buttonClass = variants({
  base: [
    "inline-flex items-center justify-center gap-tight",
    // 2px, per the radius scale: buttons and inputs sit one step below cards.
    "rounded-sm font-medium whitespace-nowrap",
    "transition-colors duration-quick ease-standard",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    // Disabled drops the fill entirely — a greyed accent still reads as an
    // available action, a sunken surface does not.
    "disabled:cursor-not-allowed disabled:bg-surface-sunken",
    "disabled:text-text-muted disabled:border-border disabled:brightness-100",
  ].join(" "),
  variants: {
    variant: {
      primary: "bg-primary text-accent-fg hover:bg-accent-hover",
      secondary:
        "border border-border bg-surface-raised text-text hover:border-border-strong hover:bg-surface-sunken",
      ghost: "text-text-secondary hover:bg-accent-soft hover:text-text",
      // Filled meaning-carrying variants take their hover from a relative
      // lightening rather than a second token, so one rule covers both themes.
      danger: "bg-negative text-accent-fg hover:brightness-110",
      agent: "bg-agent text-agent-fg hover:brightness-110",
    },
    size: {
      sm: "h-7 px-tight text-xs",
      md: "h-8 px-snug text-sm",
      lg: "h-10 px-base text-base",
    },
    fullWidth: { true: "w-full", false: "" },
  },
  defaults: { variant: "secondary", size: "md", fullWidth: false },
});

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a spinner, sets `aria-busy`, and genuinely disables the control. */
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const SPINNER_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

export default function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  className,
  disabled,
  type = "button",
  children,
  ...rest
}: ButtonProps): ReactElement {
  return (
    <button
      type={type}
      // `loading` sets the DOM attribute, so activation is actually prevented
      // rather than merely discouraged by styling.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? (
        <SpinnerIcon size={SPINNER_SIZE[size]} />
      ) : iconLeft ? (
        <span className="inline-flex shrink-0">{iconLeft}</span>
      ) : null}
      {children}
      {iconRight ? (
        <span className="inline-flex shrink-0">{iconRight}</span>
      ) : null}
    </button>
  );
}
