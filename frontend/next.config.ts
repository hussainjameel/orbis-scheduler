import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // Scoped to the public booking page only — the one route in the app that's
  // meant to be embedded via widget.js's iframe modal. `*` (any origin) is
  // correct here specifically because a business can embed its widget on any
  // domain it owns; there's no fixed allowlist to name in advance. Deliberate
  // and explicit, not an accident of omission — see docs/DEVLOG.md. If
  // broader security headers (e.g. helmet-equivalent) are ever added to this
  // app, make sure they don't overwrite or tighten this route's policy.
  async headers() {
    return [
      {
        source: "/book/:businessId",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
    ];
  },
};

export default nextConfig;
