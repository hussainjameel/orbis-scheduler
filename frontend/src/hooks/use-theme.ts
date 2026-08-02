"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "orbis-theme";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

// Shared by the desktop sidebar and mobile nav so the toggle logic and its
// localStorage key exist once. Falls back to the OS preference when nothing
// is stored yet — per the design spec's "Theme selection" decision. Reads
// happen after mount (no inline script), so first paint may briefly show
// the wrong mode; same accepted tradeoff as the sidebar's collapse state.
export function useTheme() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage/matchMedia aren't available during the server render this hydrates from
    setIsDark(dark);
    applyTheme(dark);
  }, []);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      return next;
    });
  }, []);

  return { isDark, toggle };
}
