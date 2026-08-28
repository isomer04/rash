import "@/styles/globals.css";
import type { AppProps } from "next/app";
import type { ReactElement } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ToastContainer } from "@/components/Toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/lib/theme/ThemeContext";
import { useClerkAppearance } from "@/lib/theme/clerkAppearance";

/**
 * Three faces from one family, so no seam exists between prose, heading and
 * figure. Condensed carries the display sizes by width and weight rather than by
 * switching family; Plex Mono is metrically matched to Plex Sans, which is why
 * the three are chosen together.
 */
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexSansCondensed = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

function ClerkAppearanceBridge({
  Component,
  pageProps,
}: Pick<AppProps, "Component" | "pageProps">): ReactElement {
  const appearance = useClerkAppearance();
  return (
    <ClerkProvider {...pageProps} appearance={appearance.provider}>
      <Component {...pageProps} />
      <ToastContainer />
    </ClerkProvider>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ClerkAppearanceBridge Component={Component} pageProps={pageProps} />
      </ThemeProvider>
      {/*
        Publish the hashed `next/font` family names onto the `--rash-font-*` role
        variables that `@theme inline` binds `--font-sans`, `--font-mono` and
        `--font-display` to. `html:root` (0,1,1) outranks the `:root` (0,1,0)
        placeholders in `globals.css` regardless of injection order.
      */}
      <style jsx global>{`
        html:root {
          --rash-font-display: ${plexSansCondensed.style.fontFamily};
          --rash-font-sans: ${plexSans.style.fontFamily};
          --rash-font-mono: ${plexMono.style.fontFamily};
        }
      `}</style>
    </ErrorBoundary>
  );
}
