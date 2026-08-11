import { LogoSpinner } from "@/components/logo";

// Centers within the content area (not the full viewport, and no dimming
// overlay — that's LoadingOverlay's job for blocking actions, this is just
// a page-load state). Requires its parent chain up to <main> to actually be
// a flex column for flex-1 to have a height to center within; see
// (owner)/layout.tsx.
export function RouteLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <LogoSpinner className="size-8" />
    </div>
  );
}
