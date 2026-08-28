import type { ReactElement, SVGProps } from "react";

export interface LogomarkProps
  extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Rendered box in px. Defaults to 24, matching the viewBox. */
  size?: number;
  /** `duo` tints the bars with the agent token; `mono` inherits `currentColor`. */
  tone?: "mono" | "duo";
  /** Omit for decorative use beside the wordmark. */
  title?: string;
}

/**
 * The aperture mark: a squared ring with its top-right corner cut away,
 * enclosing three ascending bars. Read one way it is a viewport onto rising
 * data; read another, the cut corner and the tallest bar — which passes out
 * through the gap — form the shoulder and stem of an *R*.
 *
 * Everything is a filled rectangle or a straight-edged path rather than a
 * stroke, so scaling never thins the mark and the same geometry rasterises to a
 * favicon without a design tool. Geometry sits on a 2px grid inside a 24×24 box:
 * the ring is a 2px wall between an r=3 outer contour and an r=1 inner one, and
 * the bars are 3px wide at heights 6, 10 and 14, baseline-aligned at y=18.
 */
export default function Logomark({
  size = 24,
  tone = "mono",
  title,
  ...rest
}: LogomarkProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...(title ? { role: "img" } : { "aria-hidden": true })}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {/*
        Ring: outer contour with the top-right 6×6 removed, minus the inner
        contour. `evenodd` makes the second subpath the aperture rather than a
        second solid.
      */}
      <path
        fillRule="evenodd"
        d="M5 2H16V8H22V19A3 3 0 0 1 19 22H5A3 3 0 0 1 2 19V5A3 3 0 0 1 5 2ZM5 4H14V10H20V19A1 1 0 0 1 19 20H5A1 1 0 0 1 4 19V5A1 1 0 0 1 5 4Z"
      />
      <g fill={tone === "duo" ? "var(--color-agent)" : "currentColor"}>
        <rect x="6" y="12" width="3" height="6" />
        <rect x="11" y="8" width="3" height="10" />
        {/* The tallest bar rises through the cut corner — the stem of the R. */}
        <rect x="16" y="4" width="3" height="14" />
      </g>
    </svg>
  );
}
