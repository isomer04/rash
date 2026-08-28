/**
 * Safe `localStorage` accessor for the theme preference.
 *
 * Key is namespaced so it cannot collide with Clerk's storage, and prefixed so
 * a future `rash.theme.v2` migration has somewhere to go.
 *
 * Neither function throws. Safari private mode throws on access rather than on
 * parse, and a storage-disabled browser throws on both read and write, so both
 * paths are wrapped. Nothing about the controller branches on storage
 * availability: a failed read yields `null`, which routes resolution to
 * `prefers-color-scheme`, and a failed write is ignored, so the in-memory state
 * and the DOM attribute still change.
 */

export const THEME_STORAGE_KEY = 'rash.theme';

/**
 * @returns {string | null} the raw stored value, or `null` when missing or unreadable
 */
export function readStoredTheme() {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * @param {string} theme
 * @returns {boolean} `true` when the write succeeded, `false` when it threw
 */
export function writeStoredTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}
