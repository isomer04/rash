import type {
  ComponentPropsWithRef,
  CSSProperties,
  ReactElement,
  ReactNode,
} from "react";
import { mergeClasses } from "@/lib/cx.mjs";

export interface Column<T> {
  key: string;
  header: ReactNode;
  numeric?: boolean;
  align?: "start" | "end" | "center";
  width?: string;
  render?: (row: T, index: number) => ReactNode;
  srOnlyHeader?: boolean;
}

export interface TableProps<T>
  extends Omit<ComponentPropsWithRef<"table">, "children"> {
  columns: ReadonlyArray<Column<T>>;
  rows: ReadonlyArray<T>;
  getRowKey: (row: T, index: number) => string;
  caption?: string;
  scrollLabel?: string;
  density?: "compact" | "default";
  zebra?: boolean;
  empty?: ReactNode;
}

const alignClass = {
  start: "text-left",
  end: "text-right",
  center: "text-center",
};

function cellClass<T>(column: Column<T>, base: string): string {
  const align = column.align ?? (column.numeric ? "end" : "start");
  return mergeClasses(
    base,
    alignClass[align],
    column.numeric ? "num" : "",
  );
}

export default function Table<T>({
  columns,
  rows,
  getRowKey,
  caption,
  scrollLabel,
  density = "default",
  zebra = false,
  empty,
  className,
  ...rest
}: TableProps<T>): ReactElement {
  const padding = density === "compact" ? "px-snug py-tight" : "px-snug py-snug";

  return (
    <div
      className="-mx-base overflow-x-auto px-base"
      role="region"
      aria-label={scrollLabel ?? caption ?? "Scrollable data table"}
      tabIndex={0}
    >
      <table
        className={mergeClasses("w-full min-w-max border-collapse text-sm text-text", className)}
        {...rest}
      >
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="border-y border-border bg-surface-raised text-2xs uppercase text-text-muted">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cellClass(column, padding)}
                style={column.width ? ({ width: column.width } as CSSProperties) : undefined}
              >
                <span className={column.srOnlyHeader ? "sr-only" : undefined}>
                  {column.header}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length ? (
            rows.map((row, index) => (
              <tr
                key={getRowKey(row, index)}
                className={mergeClasses(
                  zebra && index % 2 === 1 ? "bg-surface-sunken" : "",
                )}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cellClass(column, padding)}>
                    {column.render
                      ? column.render(row, index)
                      : (row as Record<string, ReactNode>)[column.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-base py-section text-center text-text-muted">
                {empty ?? "No data available."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TableRoot({ className, ...rest }: ComponentPropsWithRef<"table">): ReactElement {
  return <table className={mergeClasses("w-full border-collapse text-sm", className)} {...rest} />;
}
export function TableHead({ className, ...rest }: ComponentPropsWithRef<"thead">): ReactElement {
  return <thead className={mergeClasses("border-y border-border bg-surface-raised text-2xs uppercase text-text-muted", className)} {...rest} />;
}
export function TableRow({ className, ...rest }: ComponentPropsWithRef<"tr">): ReactElement {
  return <tr className={mergeClasses("border-b border-border", className)} {...rest} />;
}
export function TableCell({ className, ...rest }: ComponentPropsWithRef<"td">): ReactElement {
  return <td className={mergeClasses("px-snug py-snug text-text", className)} {...rest} />;
}
