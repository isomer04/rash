import { useMemo } from "react";
import type { Appearance } from "@clerk/types";
import { useTheme, type Theme } from "./ThemeContext";
import type { TokenMap } from "./tokens";
import { useTokenValues } from "./useTokenValues";

export interface ClerkAppearanceSet {
  provider: Appearance;
  userButton: Appearance;
}

export function buildClerkAppearance(tokens: TokenMap, theme: Theme): ClerkAppearanceSet {
  const variables: NonNullable<Appearance["variables"]> = {
    colorPrimary: tokens["--rash-accent"],
    colorPrimaryForeground: tokens["--rash-accent-fg"],
    colorBackground: tokens["--rash-surface-raised"],
    colorForeground: tokens["--rash-text"],
    colorText: tokens["--rash-text"],
    colorTextSecondary: tokens["--rash-text-secondary"],
    colorMutedForeground: tokens["--rash-text-muted"],
    colorInputBackground: tokens["--rash-surface"],
    colorInputForeground: tokens["--rash-text"],
    colorInputText: tokens["--rash-text"],
    colorNeutral: tokens["--rash-text-muted"],
    colorDanger: tokens["--rash-negative"],
    colorSuccess: tokens["--rash-positive"],
    colorWarning: tokens["--rash-warning"],
    borderRadius: "3px",
    fontFamily: "var(--font-sans)",
    fontSize: "0.9375rem",
  };
  const provider: Appearance = {
    variables,
    elements: {
      rootBox: { colorScheme: theme },
      card: {
        border: `1px solid ${tokens["--rash-border"]}`,
        borderRadius: "4px",
        boxShadow: `0 24px 56px -16px color-mix(in oklab, ${tokens["--rash-shadow"]} 45%, transparent)`,
      },
      formButtonPrimary: {
        backgroundColor: tokens["--rash-accent"],
        color: tokens["--rash-accent-fg"],
        borderRadius: "2px",
        fontWeight: 500,
      },
    },
  };
  const userButton: Appearance = {
    variables,
    elements: {
      avatarBox: {
        width: "32px",
        height: "32px",
        border: `1px solid ${tokens["--rash-border-strong"]}`,
      },
      userButtonPopoverCard: {
        backgroundColor: tokens["--rash-surface-raised"],
        color: tokens["--rash-text"],
        borderRadius: "4px",
      },
    },
  };
  return { provider, userButton };
}

export function useClerkAppearance(): ClerkAppearanceSet {
  const tokens = useTokenValues();
  const { theme } = useTheme();
  return useMemo(() => buildClerkAppearance(tokens, theme), [tokens, theme]);
}
