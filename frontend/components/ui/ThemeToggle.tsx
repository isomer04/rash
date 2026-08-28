import { useEffect, useState } from "react";
import type { ComponentPropsWithRef, ReactElement } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";
import { useTheme } from "@/lib/theme/ThemeContext";
import { nextTheme } from "@/lib/theme/resolveTheme.mjs";

export interface ThemeToggleProps
  extends Omit<ComponentPropsWithRef<"button">, "children"> {
  size?: "sm" | "md";
  /** Render the destination theme name beside the icon. */
  showLabel?: boolean;
}

const SIZES = {
  sm: { box: "h-7 w-7", icon: 16, padded: "h-7 gap-tight px-tight" },
  md: { box: "h-9 w-9", icon: 20, padded: "h-9 gap-snug px-snug" },
} as const;

/**
 * Icon-only theme switch. The icon and the accessible name both name the
 * *destination* theme, so the control reads as an action rather than as a state.
 *
 * No `aria-pressed`: this is not a two-state toggle of one concept, it is an
 * action that switches to a named alternative, and a live `aria-label` is the
 * clearer affordance.
 */
export default function ThemeToggle({
  size = "md",
  showLabel = false,
  className = "",
  onClick,
  ...rest
}: ThemeToggleProps): ReactElement {
  const { theme, toggleTheme } = useTheme();
  const scale = SIZES[size];

  /*
    The page is prerendered at build time, so the static HTML always carries the
    light-theme icon and label. The bootstrap script may have already switched
    the document to dark before React loads, which would make the first client
    render disagree with that markup and trip a hydration error.

    So the first render deliberately reproduces the server's output, and the
    real theme is adopted in an effect one tick later. Any other component that
    branches on `theme` during render needs the same treatment.
  */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const shown = mounted ? theme : "light";
  const destination = nextTheme(shown);

  return (
    <button
      type="button"
      aria-label={`Switch to ${destination} theme`}
      className={[
        "inline-flex items-center justify-center rounded-sm",
        "border border-border-strong bg-surface-raised text-text-secondary",
        "transition-colors duration-quick ease-standard",
        "hover:text-text hover:bg-surface-sunken",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        showLabel ? scale.padded : scale.box,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) toggleTheme();
      }}
      {...rest}
    >
      {shown === "dark" ? (
        <SunIcon size={scale.icon} />
      ) : (
        <MoonIcon size={scale.icon} />
      )}
      {showLabel ? (
        <span className="text-2xs uppercase">{destination}</span>
      ) : null}
    </button>
  );
}
