/**
 * Pure theme resolution. Extracted from the controller so the rule can be
 * exercised without a DOM: no `window`, no `document`, no `localStorage`.
 */

/** The complete set of themes, in a stable order. */
export const THEMES = ['light', 'dark'];

/**
 * Narrowing predicate. Total over `unknown` — anything that is not exactly
 * `'light'` or `'dark'` is not a theme.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isTheme(value) {
  return value === 'light' || value === 'dark';
}

/**
 * Resolve the theme to apply.
 *
 * Total over `unknown` for `storedValue`: any junk stored value (`''`,
 * `'Dark'`, `'system'`, a JSON blob, `null`, `undefined`, an object) falls
 * through to the media-query preference.
 *
 * @param {unknown} storedValue value read from storage, or null when unavailable
 * @param {boolean} prefersDark whether `(prefers-color-scheme: dark)` matches
 * @returns {'light' | 'dark'}
 */
export function resolveTheme(storedValue, prefersDark) {
  if (storedValue === 'light' || storedValue === 'dark') return storedValue;
  return prefersDark ? 'dark' : 'light';
}

/**
 * The theme a toggle switches to.
 *
 * @param {'light' | 'dark'} theme
 * @returns {'light' | 'dark'}
 */
export function nextTheme(theme) {
  return theme === 'dark' ? 'light' : 'dark';
}
