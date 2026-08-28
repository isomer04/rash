import { useMemo } from "react";
import { useTheme } from "./ThemeContext";
import type { TokenMap } from "./tokens";
import { useTokenValues } from "./useTokenValues";

export interface ChartTheme {
  series: readonly string[];
  axis: string;
  axisLabel: string;
  grid: string;
  cursor: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipMutedText: string;
  positive: string;
  negative: string;
  animate: boolean;
}

export function buildChartTheme(tokens: TokenMap, reducedMotion: boolean): ChartTheme {
  return {
    series: [tokens["--rash-chart-1"], tokens["--rash-chart-2"], tokens["--rash-chart-3"], tokens["--rash-chart-4"], tokens["--rash-chart-5"], tokens["--rash-chart-6"]],
    axis: tokens["--rash-border-strong"],
    axisLabel: tokens["--rash-text-muted"],
    grid: tokens["--rash-border"],
    cursor: tokens["--rash-surface-sunken"],
    tooltipBg: tokens["--rash-surface-raised"],
    tooltipBorder: tokens["--rash-border-strong"],
    tooltipText: tokens["--rash-text"],
    tooltipMutedText: tokens["--rash-text-secondary"],
    positive: tokens["--rash-positive"],
    negative: tokens["--rash-negative"],
    animate: !reducedMotion,
  };
}

export function useChartTheme(): ChartTheme {
  const tokens = useTokenValues();
  const { reducedMotion } = useTheme();
  return useMemo(() => buildChartTheme(tokens, reducedMotion), [tokens, reducedMotion]);
}
