import { LogoSpinner } from "@/components/logo";
import { ThemeScript } from "./theme-script";

// Not RouteLoading (frontend/src/components/route-loading.tsx) — that component
// relies on a flex-column ancestor only the (owner) layout provides. This route has
// no such wrapper, so it centers against the full viewport directly.
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <ThemeScript />
      <LogoSpinner className="size-8" />
    </div>
  );
}
