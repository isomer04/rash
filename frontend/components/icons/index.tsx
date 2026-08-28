import type { ReactElement, SVGProps } from "react";

/**
 * Hand-authored inline SVG icon set. No icon library.
 *
 * Convention, shared by every glyph here: a 20×20 viewBox, `fill="none"`,
 * `stroke="currentColor"` at 1.5 with round caps and joins, so an icon inherits
 * the text colour of whatever token-classed element contains it.
 *
 * Icons are `aria-hidden` by default so a decorative glyph cannot leak into an
 * accessible name. Passing `title` switches the element to `role="img"` with a
 * `<title>` child, which is the only case where an icon contributes a name.
 */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Rendered box in px. Defaults to 20, matching the viewBox. */
  size?: number;
  /** When present, the icon becomes a labelled image instead of decoration. */
  title?: string;
}

/** Shared attribute set, so the convention lives in one place. */
function svgProps({ size = 20, title, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...(title ? { role: "img" as const } : { "aria-hidden": true as const }),
    ...rest,
  };
}

export function SunIcon({ size, title, ...rest }: IconProps): ReactElement {
  return (
    <svg {...svgProps({ size, title, ...rest })}>
      {title ? <title>{title}</title> : null}
      <circle cx="10" cy="10" r="3.75" />
      <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6L16 16M16 4l-1.4 1.4M5.4 14.6L4 16" />
    </svg>
  );
}

export function MoonIcon({ size, title, ...rest }: IconProps): ReactElement {
  return (
    <svg {...svgProps({ size, title, ...rest })}>
      {title ? <title>{title}</title> : null}
      <path d="M16.5 12.4A7 7 0 0 1 7.6 3.5a7 7 0 1 0 8.9 8.9Z" />
    </svg>
  );
}
/** Concentric rings closing on a point — a stated objective. */
export function TargetIcon({ size, title, ...rest }: IconProps): ReactElement {
  return (
    <svg {...svgProps({ size, title, ...rest })}>
      {title ? <title>{title}</title> : null}
      <circle cx="10" cy="10" r="7.25" />
      <circle cx="10" cy="10" r="3.75" />
      <path d="M10 8.5v3M8.5 10h3" />
    </svg>
  );
}

/** A drafting hourglass: a horizon between two funnels. Time to a goal. */
export function HourglassIcon({ size, title, ...rest }: IconProps): ReactElement {
  return (
    <svg {...svgProps({ size, title, ...rest })}>
      {title ? <title>{title}</title> : null}
      <path d="M5.5 2.5h9M5.5 17.5h9" />
      <path d="M6.5 2.5v3L10 10l3.5-4.5v-3" />
      <path d="M6.5 17.5v-3L10 10l3.5 4.5v3" />
    </svg>
  );
}

/** A circle with one sector ruled off — composition by share. */
export function ChartPieIcon({ size, title, ...rest }: IconProps): ReactElement {
  return (
    <svg {...svgProps({ size, title, ...rest })}>
      {title ? <title>{title}</title> : null}
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 2.75v7.25h7.25" />
    </svg>
  );
}

/** A sheet with a folded corner and three ruled lines — a written report. */
export function DocumentIcon({ size, title, ...rest }: IconProps): ReactElement {
  return (
    <svg {...svgProps({ size, title, ...rest })}>
      {title ? <title>{title}</title> : null}
      <path d="M11.5 2.5H5.75A1.25 1.25 0 0 0 4.5 3.75v12.5a1.25 1.25 0 0 0 1.25 1.25h8.5a1.25 1.25 0 0 0 1.25-1.25V6.5Z" />
      <path d="M11.5 2.5V6.5h4" />
      <path d="M7.5 10.5h5M7.5 13.5h5" />
    </svg>
  );
}

/** A rising polyline with an arrowhead — direction of travel, upward. */
export function TrendUpIcon({ size, title, ...rest }: IconProps): ReactElement {
  return (
    <svg {...svgProps({ size, title, ...rest })}>
      {title ? <title>{title}</title> : null}
      <path d="M2.5 14.5 7 10l3 3 5.5-5.5" />
      <path d="M11.5 7.5h4v4" />
    </svg>
  );
}

/** A struck bolt — work happening now. */
export function BoltIcon({ size, title, ...rest }: IconProps): ReactElement {
  return (
    <svg {...svgProps({ size, title, ...rest })}>
      {title ? <title>{title}</title> : null}
      <path d="M11 2.5 4.5 11.5h4l-.5 6 6.5-9h-4Z" />
    </svg>
  );
}

/** A shield on a 2px grid — custody of data. */
export function ShieldIcon({ size, title, ...rest }: IconProps): ReactElement {
  return (
    <svg {...svgProps({ size, title, ...rest })}>
      {title ? <title>{title}</title> : null}
      <path d="M10 2.5 4 4.5v5c0 3.5 2.4 6.6 6 8 3.6-1.4 6-4.5 6-8v-5Z" />
      <path d="M7.5 9.75 9.5 12l3.5-4" />
    </svg>
  );
}

/** A rule terminating in an arrowhead — continue, proceed. */
export function ArrowRightIcon({ size, title, ...rest }: IconProps): ReactElement {
  return (
    <svg {...svgProps({ size, title, ...rest })}>
      {title ? <title>{title}</title> : null}
      <path d="M3 10h14" />
      <path d="M12 5l5 5-5 5" />
    </svg>
  );
}

/**
 * A three-quarter arc, rotating. Work in progress on a control.
 *
 * The rotation is the one place an icon carries motion; `prefers-reduced-motion`
 * collapses it to a static arc through the global reduced-motion block, and the
 * control it sits on is also `disabled` and `aria-busy`, so no information is
 * carried by the movement alone.
 */
export function SpinnerIcon({
  size,
  title,
  className = "",
  ...rest
}: IconProps): ReactElement {
  return (
    <svg
      {...svgProps({
        size,
        title,
        className: `animate-spin ${className}`.trim(),
        ...rest,
      })}
    >
      {title ? <title>{title}</title> : null}
      <path d="M10 2.75a7.25 7.25 0 1 0 7.25 7.25" />
    </svg>
  );
}

function makeIcon(paths: ReactElement | ReactElement[]) {
  return function Icon({ size, title, ...rest }: IconProps): ReactElement {
    return (
      <svg {...svgProps({ size, title, ...rest })}>
        {title ? <title>{title}</title> : null}
        {paths}
      </svg>
    );
  };
}

export const TrendDownIcon = makeIcon([
  <path key="line" d="M2.5 5.5 7 10l3-3 5.5 5.5" />,
  <path key="head" d="M11.5 12.5h4v-4" />,
]);
export const TrendFlatIcon = makeIcon([
  <path key="line" d="M2.5 10h14" />,
  <path key="head" d="m13 6.5 3.5 3.5-3.5 3.5" />,
]);
export const CheckIcon = makeIcon(<path d="m3.5 10 4 4 9-9" />);
export const AlertIcon = makeIcon([
  <path key="shape" d="M10 2.5 18 17H2Z" />,
  <path key="mark" d="M10 7v4.5M10 14.25v.25" />,
]);
export const InfoIcon = makeIcon([
  <circle key="shape" cx="10" cy="10" r="7.25" />,
  <path key="mark" d="M10 9v5M10 6.25v.25" />,
]);
export const CloseIcon = makeIcon(<path d="m4 4 12 12M16 4 4 16" />);
export const ChevronDownIcon = makeIcon(<path d="m5 7.5 5 5 5-5" />);
export const ChevronRightIcon = makeIcon(<path d="m7.5 5 5 5-5 5" />);
export const ExternalLinkIcon = makeIcon([
  <path key="box" d="M9 4H4.5A1.5 1.5 0 0 0 3 5.5v10A1.5 1.5 0 0 0 4.5 17h10a1.5 1.5 0 0 0 1.5-1.5V11" />,
  <path key="arrow" d="M11 3h6v6M9 11l8-8" />,
]);
export const MenuIcon = makeIcon(<path d="M3 5h14M3 10h14M3 15h14" />);
export const PencilIcon = makeIcon([
  <path key="body" d="m4 13.5-.75 3.25L6.5 16 16 6.5 13.5 4Z" />,
  <path key="end" d="m12 5.5 2.5 2.5" />,
]);
export const PlusIcon = makeIcon(<path d="M10 3v14M3 10h14" />);
export const RefreshIcon = makeIcon([
  <path key="top" d="M16.5 7A7 7 0 0 0 4.25 5.25L2.5 7" />,
  <path key="bottom" d="M3.5 13A7 7 0 0 0 15.75 14.75L17.5 13" />,
  <path key="heads" d="M2.5 3v4h4M17.5 17v-4h-4" />,
]);
export const TrashIcon = makeIcon([
  <path key="lid" d="M3.5 5.5h13M7 5.5V3h6v2.5" />,
  <path key="bin" d="m5.5 5.5.75 11h7.5l.75-11M8.5 8.5v5M11.5 8.5v5" />,
]);
export const WalletIcon = makeIcon([
  <path key="body" d="M3 5.5A2.5 2.5 0 0 1 5.5 3H15v14H5.5A2.5 2.5 0 0 1 3 14.5Z" />,
  <path key="pocket" d="M12 8h5v4h-5a2 2 0 0 1 0-4ZM13.5 10h.25" />,
]);
export const AgentsIcon = makeIcon([
  <circle key="one" cx="7" cy="7" r="2.5" />,
  <circle key="two" cx="14" cy="8" r="2" />,
  <path key="group" d="M2.5 16c.4-3 2-4.5 4.5-4.5s4.1 1.5 4.5 4.5M11 12.5c.8-.8 1.8-1.25 3-1.25 2.1 0 3.3 1.4 3.5 3.75" />,
]);
export const SparkIcon = makeIcon([
  <path key="large" d="M10 2.5c.4 4.2 2.3 6.1 6.5 6.5-4.2.4-6.1 2.3-6.5 6.5C9.6 11.3 7.7 9.4 3.5 9 7.7 8.6 9.6 6.7 10 2.5Z" />,
  <path key="small" d="M16 13.5c.15 1.35.65 1.85 2 2-1.35.15-1.85.65-2 2-.15-1.35-.65-1.85-2-2 1.35-.15 1.85-.65 2-2Z" />,
]);
