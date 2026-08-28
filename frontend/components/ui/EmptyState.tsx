import type { ComponentPropsWithRef, ReactElement, ReactNode } from "react";
import { mergeClasses } from "@/lib/cx.mjs";

export interface EmptyStateProps extends ComponentPropsWithRef<"div"> {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

export default function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  ...rest
}: EmptyStateProps): ReactElement {
  return (
    <div
      className={mergeClasses(
        "flex min-h-40 flex-col items-center justify-center border-y border-border px-base py-section text-center",
        className,
      )}
      {...rest}
    >
      {icon ? <div className="mb-snug text-text-muted">{icon}</div> : null}
      <h3 className="text-lg font-medium text-text">{title}</h3>
      {description ? (
        <div className="mt-tight max-w-md text-sm text-text-secondary">{description}</div>
      ) : null}
      {action ? <div className="mt-base">{action}</div> : null}
    </div>
  );
}
