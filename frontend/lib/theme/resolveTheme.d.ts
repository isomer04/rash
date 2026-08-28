export type Theme = 'light' | 'dark';

export declare const THEMES: readonly Theme[];

export declare function isTheme(value: unknown): value is Theme;

export declare function resolveTheme(storedValue: unknown, prefersDark: boolean): Theme;

export declare function nextTheme(theme: Theme): Theme;
