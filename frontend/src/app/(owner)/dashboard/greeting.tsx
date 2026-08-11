"use client";

import { useEffect, useState } from "react";

type DayPart = "morning" | "afternoon" | "evening";

function partFromHour(hour: number): DayPart {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

// Reflects the visitor's own local clock, not the server's — the server's
// timezone has no relationship to the owner's. Seeded with a fixed,
// deterministic default so server render and first client paint agree
// (avoiding a hydration mismatch), then corrected from the browser's real
// clock post-mount. Same accepted "first paint may briefly show the wrong
// value" tradeoff already used by use-theme.ts and the sidebar's collapse
// state.
export function Greeting({ firstName }: { firstName: string }) {
  const [part, setPart] = useState<DayPart>("morning");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-local time isn't available during the server render this hydrates from
    setPart(partFromHour(new Date().getHours()));
  }, []);

  return (
    <h1 className="mb-1 text-2xl font-medium text-text-primary">
      Good {part}, {firstName}
    </h1>
  );
}
