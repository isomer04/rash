import { useLayoutEffect, useState } from "react";
import { useTheme } from "./ThemeContext";
import { TOKEN_FALLBACK } from "./tokenFallback";
import { TOKEN_NAMES, type TokenMap } from "./tokens";

export function useTokenValues(): TokenMap {
  const { theme } = useTheme();
  const [tokens, setTokens] = useState<TokenMap>(TOKEN_FALLBACK.light);

  useLayoutEffect(() => {
    const fallback = TOKEN_FALLBACK[theme];
    const styles = window.getComputedStyle(document.documentElement);
    const next = {} as TokenMap;
    for (const name of TOKEN_NAMES) {
      next[name] = styles.getPropertyValue(name).trim() || fallback[name];
    }
    setTokens(next);
  }, [theme]);

  return tokens;
}
