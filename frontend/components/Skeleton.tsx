import type { ReactElement } from "react";
import { Card } from "@/components/ui";
import { mergeClasses } from "@/lib/cx.mjs";

export function Skeleton({ className = "" }: { className?: string }): ReactElement {
  return <div className={mergeClasses("animate-shimmer rounded-sm bg-surface-sunken", className)} aria-hidden="true" />;
}
export function SkeletonText({ lines = 1 }: { lines?: number }): ReactElement {
  return <div className="space-y-snug">{Array.from({ length: lines }).map((_, index) => <Skeleton key={index} className="h-4 w-full" />)}</div>;
}
export function SkeletonCard(): ReactElement {
  return <Card aria-busy="true"><Skeleton className="mb-base h-6 w-1/3" /><SkeletonText lines={3} /></Card>;
}
export function SkeletonTable({ rows = 3 }: { rows?: number }): ReactElement {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface-raised" aria-busy="true">
      <div className="border-b border-border p-base"><Skeleton className="h-6 w-1/4" /></div>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex gap-base border-b border-border p-base last:border-b-0">
          <Skeleton className="h-4 w-1/4" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-1/6" /><Skeleton className="h-4 w-1/6" />
        </div>
      ))}
    </div>
  );
}
