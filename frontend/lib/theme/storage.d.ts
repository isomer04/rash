import type { Theme } from './resolveTheme';

export declare const THEME_STORAGE_KEY: 'rash.theme';

export declare function readStoredTheme(): string | null;

export declare function writeStoredTheme(theme: Theme): boolean;
