"use client";

import { useEffect } from "react";

// Only relevant when this page is actually framed (the embeddable widget's modal) —
// a cross-origin iframe's keydown events never bubble to the parent page's own
// listeners, so widget.js has no way to see an Escape press once focus moves into
// this page's content, which happens the moment a visitor interacts with the form.
// This forwards it via postMessage instead. A no-op on a direct, non-framed visit.
export function IframeEscapeBridge() {
  useEffect(() => {
    if (window.self === window.top) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        window.parent.postMessage({ source: "orbis-widget", type: "escape" }, "*");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
