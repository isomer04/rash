export const TOKEN_NAMES = [
  "--rash-surface", "--rash-surface-raised", "--rash-surface-sunken", "--rash-surface-overlay",
  "--rash-text", "--rash-text-secondary", "--rash-text-muted", "--rash-text-inverse",
  "--rash-border", "--rash-border-strong",
  "--rash-accent", "--rash-accent-hover", "--rash-accent-fg", "--rash-accent-soft",
  "--rash-agent", "--rash-agent-fg", "--rash-agent-soft",
  "--rash-positive", "--rash-positive-soft", "--rash-negative", "--rash-negative-soft",
  "--rash-warning", "--rash-warning-fill", "--rash-warning-fg", "--rash-warning-soft",
  "--rash-focus", "--rash-shadow",
  "--rash-chart-1", "--rash-chart-2", "--rash-chart-3",
  "--rash-chart-4", "--rash-chart-5", "--rash-chart-6",
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];
export type TokenMap = Record<TokenName, string>;
