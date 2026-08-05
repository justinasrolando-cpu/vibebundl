import Script from "next/script";

export const THEME_STORAGE_KEY = "vb-theme";

/**
 * Stamps `data-theme` on <html> before the browser paints anything.
 *
 * This has to be a blocking inline script in the document head, and it has
 * to run before React hydrates. Any React-side alternative — an effect, a
 * layout effect, a context — runs after the first paint, which means a dark
 * flash on every navigation for a light-mode user. That flash is the single
 * most common way a theme toggle feels broken, and it can't be fixed later:
 * by the time your JS runs, the wrong pixels are already on screen.
 *
 * Precedence: an explicit choice in localStorage wins; otherwise the OS
 * preference; otherwise dark, which is the brand.
 *
 * `suppressHydrationWarning` on <html> is required because this script
 * mutates the attribute the server rendered.
 *
 * It goes through next/script rather than a bare <script> tag. A bare tag
 * renders and runs correctly from the server HTML, but React warns about it
 * on every page ("scripts inside React components are never executed when
 * rendering on the client") — and the warning is telling the truth: on a
 * client-side navigation nothing re-runs it. That happens to be harmless
 * here, because the attribute it sets lives on <html> and survives every
 * in-app navigation. `beforeInteractive` says the same thing without the
 * noise, and says it in the way Next can actually reason about.
 */
export default function ThemeScript() {
  const js = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
var t=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");
document.documentElement.setAttribute("data-theme",t);
}catch(e){document.documentElement.setAttribute("data-theme","dark")}})()`;

  return (
    <Script id="vb-theme" strategy="beforeInteractive">
      {js}
    </Script>
  );
}
