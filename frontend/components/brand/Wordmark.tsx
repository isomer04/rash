import type { ComponentPropsWithRef, ReactElement } from "react";
import Logomark from "@/components/brand/Logomark";
import { mergeClasses } from "@/lib/cx.mjs";

export type WordmarkSize = "sm" | "md" | "lg";

/** The product name, exactly. Nothing is appended to it inside the lockup. */
const NAME = "Rash";

/**
 * The descriptor. It is a separate eyebrow line rather than part of the name, so
 * it can be omitted wherever it does not earn its space.
 */
const DESCRIPTOR = "AI financial advisor";

const SIZES: Record<WordmarkSize, { name: string; mark: number }> = {
  sm: { name: "text-lg", mark: 20 },
  md: { name: "text-xl", mark: 24 },
  lg: { name: "text-2xl", mark: 28 },
};

export interface WordmarkProps extends ComponentPropsWithRef<"span"> {
  size?: WordmarkSize;
  showMark?: boolean;
  /** Renders the `2xs` uppercase descriptor beneath the name. */
  tagline?: boolean;
}

/**
 * The lockup replaces `Rash AI Financial Advisor` in two colours inside one
 * heading. The name stands alone in the condensed display face at the `xl` step
 * with -0.02em tracking; the descriptor becomes an eyebrow in muted text.
 *
 * Presence comes from the face's own width and tracking, never from `font-bold`.
 */
export default function Wordmark({
  size = "md",
  showMark = true,
  tagline = false,
  className,
  ...rest
}: WordmarkProps): ReactElement {
  const scale = SIZES[size];

  return (
    <span
      className={mergeClasses("inline-flex items-center gap-snug", className)}
      {...rest}
    >
      {showMark ? <Logomark size={scale.mark} className="shrink-0" /> : null}
      <span className="inline-flex flex-col justify-center">
        <span
          className={mergeClasses(
            "font-display font-semibold leading-none tracking-[-0.02em] text-text",
            scale.name,
          )}
        >
          {NAME}
        </span>
        {tagline ? (
          <span className="mt-tight text-2xs uppercase text-text-muted">
            {DESCRIPTOR}
          </span>
        ) : null}
      </span>
    </span>
  );
}
