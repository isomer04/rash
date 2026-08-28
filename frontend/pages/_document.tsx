import { Html, Head, Main, NextScript } from "next/document";

/**
 * Pre-paint theme bootstrap.
 *
 * Runs synchronously immediately after the authoritative theme-color node and
 * ahead of the stylesheet links Next injects, so the document is already themed
 * at first paint and there is no flash of the wrong theme.
 *
 * Three deliberate choices:
 *
 * - The whole body is inside `try`. A bootstrap that throws would leave the
 *   document unthemed, which is worse than any wrong theme.
 * - The inner `try` around `getItem` is separate because Safari private mode
 *   throws on access, not on parse.
 * - The two surface hex values are literal. The script runs before the
 *   stylesheet is applied, so `getComputedStyle` cannot resolve `--rash-surface`
 *   yet. This is the only place outside `styles/globals.css` where a colour
 *   literal is permitted. `ThemeProvider` re-reads the token after mount, so CSS
 *   stays authoritative for the steady state.
 * - It writes `data-theme`, not a class: class-based theming collides with
 *   Tailwind's `dark:` defaults and with the font-variable classes, and the
 *   attribute gives the (0,2,0) specificity the token blocks rely on.
 */
const THEME_BOOTSTRAP = `(function(){try{
  var k="rash.theme",t=null;
  try{t=window.localStorage.getItem(k)}catch(e){}
  if(t!=="light"&&t!=="dark"){
    t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
  }
  var r=document.documentElement;
  r.setAttribute("data-theme",t);
  r.style.colorScheme=t;
  var m=document.querySelector('meta[name="theme-color"]');
  if(m)m.setAttribute("content",t==="dark"?"#121212":"#F1F1F1");
}catch(e){}})();`;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="theme-color" content="#F1F1F1" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="description" content="Rash AI Financial Advisor - Your intelligent portfolio management assistant" />
        {/*
          One authoritative theme-color node, not a media-query pair. The
          bootstrap script and ThemeProvider both rewrite this single node's
          content, so browser chrome follows the active theme rather than the OS
          preference. The static value is the light page surface.
        */}
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
