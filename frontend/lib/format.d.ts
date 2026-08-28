export type SignTone = "positive" | "negative" | "flat";
export type SignIcon = "trend-up" | "trend-down" | "trend-flat";
export type FigureFormat = "percent" | "currency" | "plain";

export interface SignPresentation {
  tone: SignTone;
  className: string;
  icon: SignIcon;
  label: "up" | "down" | "unchanged";
}

export function signTone(value: number): SignPresentation;
export function formatCurrency(value: number): string;
export function formatPercent(value: number): string;
export function formatPlain(value: number): string;
export function formatFigure(value: number, format?: FigureFormat): string;
