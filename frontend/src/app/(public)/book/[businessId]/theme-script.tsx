// This page has no login and no manual toggle (nowhere in the locked design for one —
// unlike every other screen, it has no header/sidebar chrome to put it in), so an
// anonymous visitor's only signal is OS preference. useTheme() (hooks/use-theme.ts,
// the app's only other dark-mode logic) is a useEffect that runs after mount and
// documents its own flash-of-light-mode as an accepted tradeoff for the authenticated
// dashboard — not acceptable for a public first-impression page, so this renders a
// real blocking <script> instead: part of the server-rendered HTML, executed by the
// browser as it parses, before hydration paints anything. Reads the same localStorage
// key useTheme() uses first (a visitor who's also used the owner dashboard on this
// browser gets their real preference), falling back to prefers-color-scheme. Used by
// both page.tsx (every return branch) and loading.tsx, so a cold visitor never sees a
// light-mode flash on either the loading spinner or the loaded content.
export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var s=localStorage.getItem("orbis-theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`,
      }}
    />
  );
}
