import type { ComponentPropsWithRef, ReactElement } from "react";
import { mergeClasses, variants } from "@/lib/cx.mjs";

export type CardTone = "default" | "sunken" | "accent" | "agent";
export type CardPadding = "none" | "snug" | "base" | "loose";

/**
 * A card here groups; it does not lift. `--shadow-raise` is a hard 1px offset
 * with zero blur — a sheet resting on a sheet — and the radius is 3px, the
 * panel step. Literal surfaces, generic elevation, and oversized ordinary
 * corners are intentionally excluded.
 *
 * Nesting depth is capped at 2 by the direction: a Card may hold a Table or a
 * StatGrid, never another Card.
 */
export const cardClass = variants({
  base: "rounded-md border border-border bg-surface-raised shadow-raise",
  variants: {
    tone: {
      default: "",
      sunken: "bg-surface-sunken",
      accent: "bg-accent-soft",
      agent: "bg-agent-soft border-agent",
    },
    padding: {
      none: "",
      snug: "p-snug",
      base: "p-base",
      loose: "p-loose",
    },
  },
  defaults: { tone: "default", padding: "loose" },
});

export interface CardProps extends ComponentPropsWithRef<"div"> {
  tone?: CardTone;
  padding?: CardPadding;
}

export default function Card({
  tone = "default",
  padding = "loose",
  className,
  ...rest
}: CardProps): ReactElement {
  return (
    <div
      className={cardClass({ tone, padding, className })}
      {...rest}
    />
  );
}

export function CardHeader({
  className,
  ...rest
}: ComponentPropsWithRef<"div">): ReactElement {
  return (
    <div
      className={mergeClasses(
        "flex items-start justify-between gap-base",
        className,
      )}
      {...rest}
    />
  );
}

export interface CardTitleProps extends ComponentPropsWithRef<"h3"> {
  /**
   * A `2xs` uppercase line above the title. Uppercase is the one structural
   * signal in this system, so it appears here and on stat labels and table
   * headers — never on a button, a nav item or a badge.
   */
  eyebrow?: string;
}

export function CardTitle({
  eyebrow,
  className,
  children,
  ...rest
}: CardTitleProps): ReactElement {
  return (
    <div className="min-w-0">
      {eyebrow ? (
        <p className="text-2xs uppercase text-text-muted">{eyebrow}</p>
      ) : null}
      <h3
        className={mergeClasses(
          "text-lg font-medium text-text",
          eyebrow ? "mt-tight" : "",
          className,
        )}
        {...rest}
      >
        {children}
      </h3>
    </div>
  );
}

export function CardBody({
  className,
  ...rest
}: ComponentPropsWithRef<"div">): ReactElement {
  return (
    <div
      className={mergeClasses("text-base text-text-secondary", className)}
      {...rest}
    />
  );
}

/** Separated from the body by a rule, not by a change of background. */
export function CardFooter({
  className,
  ...rest
}: ComponentPropsWithRef<"div">): ReactElement {
  return (
    <div
      className={mergeClasses(
        "mt-base flex items-center gap-snug border-t border-border pt-base",
        className,
      )}
      {...rest}
    />
  );
}
