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
 */
export default function ThemeScript() {
  const js = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
var t=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");
document.documentElement.setAttribute("data-theme",t);
}catch(e){document.documentElement.setAttribute("data-theme","dark")}})()`;

  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
