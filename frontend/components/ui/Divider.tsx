import type { ComponentPropsWithRef, ReactElement } from "react";
import { mergeClasses } from "@/lib/cx.mjs";

export interface DividerProps extends ComponentPropsWithRef<"div"> {
  orientation?: "horizontal" | "vertical";
  tone?: "default" | "strong";
  label?: string;
  spacing?: "none" | "snug" | "base" | "loose";
}

const spacingClass = {
  horizontal: { none: "", snug: "my-snug", base: "my-base", loose: "my-loose" },
  vertical: { none: "", snug: "mx-snug", base: "mx-base", loose: "mx-loose" },
};

export default function Divider({
  orientation = "horizontal",
  tone = "default",
  label,
  spacing = "base",
  className,
  ...rest
}: DividerProps): ReactElement {
  const border = tone === "strong" ? "border-border-strong" : "border-border";
  if (label) {
    return (
      <div className={mergeClasses("flex items-center gap-snug", spacingClass.horizontal[spacing], className)} role="group" aria-label={label} {...rest}>
        <span className={mergeClasses("h-hair flex-1 border-t", border)} />
        <span className="text-xs text-text-muted">{label}</span>
        <span className={mergeClasses("h-hair flex-1 border-t", border)} />
      </div>
    );
  }
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={mergeClasses(
        orientation === "horizontal"
          ? `w-full border-t ${spacingClass.horizontal[spacing]}`
          : `h-full self-stretch border-l ${spacingClass.vertical[spacing]}`,
        border,
        className,
      )}
      {...rest}
    />
  );
}
