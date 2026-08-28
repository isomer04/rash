import type { Theme } from "./ThemeContext";
import type { TokenMap } from "./tokens";

export const TOKEN_FALLBACK: Record<Theme, TokenMap> = {
  light: {
    "--rash-surface": "#F1F1F1", "--rash-surface-raised": "#FAFAFA", "--rash-surface-sunken": "#E6E6E6", "--rash-surface-overlay": "rgb(20 20 20 / 0.58)",
    "--rash-text": "#141414", "--rash-text-secondary": "#454545", "--rash-text-muted": "#666666", "--rash-text-inverse": "#F7F7F7",
    "--rash-border": "#D4D4D4", "--rash-border-strong": "#868686",
    "--rash-accent": "#17212B", "--rash-accent-hover": "#0D141B", "--rash-accent-fg": "#FFFFFF", "--rash-accent-soft": "color-mix(in oklab, #17212B 6%, #FAFAFA)",
    "--rash-agent": "#6A3D7A", "--rash-agent-fg": "#FFFFFF", "--rash-agent-soft": "color-mix(in oklab, #6A3D7A 10%, #FAFAFA)",
    "--rash-positive": "#12704F", "--rash-positive-soft": "color-mix(in oklab, #12704F 10%, #FAFAFA)",
    "--rash-negative": "#B4231F", "--rash-negative-soft": "color-mix(in oklab, #B4231F 10%, #FAFAFA)",
    "--rash-warning": "#8A5D06", "--rash-warning-fill": "#F0B429", "--rash-warning-fg": "#2A1F05", "--rash-warning-soft": "color-mix(in oklab, #F0B429 14%, #FAFAFA)",
    "--rash-focus": "#17212B", "--rash-shadow": "#141414",
    "--rash-chart-1": "#2E3A46", "--rash-chart-2": "#6A3D7A", "--rash-chart-3": "#12704F", "--rash-chart-4": "#8A5D06", "--rash-chart-5": "#3E6C8E", "--rash-chart-6": "#8C3B5C",
  },
  dark: {
    "--rash-surface": "#121212", "--rash-surface-raised": "#1A1A1A", "--rash-surface-sunken": "#0C0C0C", "--rash-surface-overlay": "rgb(0 0 0 / 0.66)",
    "--rash-text": "#EDEDED", "--rash-text-secondary": "#B3B3B3", "--rash-text-muted": "#8A8A8A", "--rash-text-inverse": "#121212",
    "--rash-border": "#2B2B2B", "--rash-border-strong": "#6E6E6E",
    "--rash-accent": "#EDEDED", "--rash-accent-hover": "#FFFFFF", "--rash-accent-fg": "#121212", "--rash-accent-soft": "color-mix(in oklab, #EDEDED 10%, #1A1A1A)",
    "--rash-agent": "#C79BD8", "--rash-agent-fg": "#121212", "--rash-agent-soft": "color-mix(in oklab, #C79BD8 16%, #1A1A1A)",
    "--rash-positive": "#4ED09A", "--rash-positive-soft": "color-mix(in oklab, #4ED09A 14%, #1A1A1A)",
    "--rash-negative": "#FF8078", "--rash-negative-soft": "color-mix(in oklab, #FF8078 14%, #1A1A1A)",
    "--rash-warning": "#F0B429", "--rash-warning-fill": "#F0B429", "--rash-warning-fg": "#2A1F05", "--rash-warning-soft": "color-mix(in oklab, #F0B429 16%, #1A1A1A)",
    "--rash-focus": "#EDEDED", "--rash-shadow": "#000000",
    "--rash-chart-1": "#C8CDD3", "--rash-chart-2": "#C79BD8", "--rash-chart-3": "#4ED09A", "--rash-chart-4": "#F0B429", "--rash-chart-5": "#79B4D8", "--rash-chart-6": "#F0899F",
  },
};
