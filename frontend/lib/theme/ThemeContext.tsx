import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";
import { isTheme, nextTheme, resolveTheme } from "./resolveTheme.mjs";
import { readStoredTheme, writeStoredTheme } from "./storage.mjs";

export type Theme = "light" | "dark";

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** True once the user has made an explicit choice. */
  hasStoredPreference: boolean;
  reducedMotion: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** Matches `--duration-base`; long enough for the transition, short enough not to linger. */
const TRANSITION_MS = 180;

/**
 * The theme the bootstrap script already applied. Consumers do not read it
 * during hydration: static HTML was rendered with light state, so React must do
 * the same first client render. The provider adopts this value in an effect.
 */
function readAppliedTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const applied = document.documentElement.getAttribute("data-theme");
  return isTheme(applied) ? (applied as Theme) : "light";
}

function matches(query: string): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(query).matches;
}

/**
 * Write the theme to the DOM. Idempotent, which matters under `reactStrictMode`'s
 * double effect invocation. The `theme-color` value is read back from the
 * computed `--rash-surface` so CSS stays the single source of truth once the
 * stylesheet has applied; the bootstrap literal is only the pre-paint stand-in.
 */
function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const surface = window
      .getComputedStyle(root)
      .getPropertyValue("--rash-surface")
      .trim();
    if (surface) meta.setAttribute("content", surface);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }): ReactElement {
  const [theme, setThemeState] = useState<Theme>("light");
  const [hasStoredPreference, setHasStoredPreference] = useState<boolean>(() =>
    isTheme(readStoredThemeSafely())
  );
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adoptedBootstrapTheme = useRef(false);

  /**
   * Add `theme-transition` for the length of the change, then remove it. Skipped
   * entirely when reduced motion is requested, so that path is an absence of
   * behaviour rather than an override.
   */
  const runTransition = useCallback(() => {
    if (reducedMotion || typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.add("theme-transition");
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => {
      root.classList.remove("theme-transition");
      transitionTimer.current = null;
    }, TRANSITION_MS);
  }, [reducedMotion]);

  const setTheme = useCallback(
    (next: Theme) => {
      // Attribute first, synchronously in the handler: React batches the state
      // update, but the tokens for the new theme are already in effect for the
      // paint this interaction produces.
      runTransition();
      applyTheme(next);
      writeStoredTheme(next);
      setHasStoredPreference(true);
      setThemeState(next);
    },
    [runTransition]
  );

  const toggleTheme = useCallback(() => {
    setTheme(nextTheme(theme) as Theme);
  }, [setTheme, theme]);

  // Adopt the pre-paint result only after hydration. Subsequent runs re-sync the
  // DOM from the token layer, so the meta value comes from CSS rather than from
  // the bootstrap literal.
  useEffect(() => {
    if (!adoptedBootstrapTheme.current) {
      adoptedBootstrapTheme.current = true;
      const applied = readAppliedTheme();
      applyTheme(applied);
      if (applied !== theme) setThemeState(applied);
      return;
    }
    applyTheme(theme);
  }, [theme]);

  // Reduced motion, tracked live.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Follow the OS only until the user makes an explicit choice.
  useEffect(() => {
    if (hasStoredPreference) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      const next = resolveTheme(null, event.matches) as Theme;
      applyTheme(next);
      setThemeState(next);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [hasStoredPreference]);

  // Keep tabs in step. Not required, but it prevents a split-brain.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "rash.theme") return;
      const next = resolveTheme(event.newValue, matches(DARK_QUERY)) as Theme;
      setHasStoredPreference(isTheme(event.newValue));
      applyTheme(next);
      setThemeState(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(
    () => () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    },
    []
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme, hasStoredPreference, reducedMotion }),
    [theme, setTheme, toggleTheme, hasStoredPreference, reducedMotion]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return value;
}

/** Prerender-safe wrapper: `readStoredTheme` touches `window`. */
function readStoredThemeSafely(): string | null {
  if (typeof window === "undefined") return null;
  return readStoredTheme();
}
