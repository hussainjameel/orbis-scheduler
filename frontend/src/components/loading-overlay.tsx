import { LogoSpinner } from "@/components/logo";

// Full-screen loading state for an in-flight mutation — deliberately not an
// in-button spinner, which reads as too subtle for actions with real
// consequences (approve/reject/cancel). Reduced-motion is already handled
// globally in globals.css, so LogoSpinner's animation is covered for free.
export function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <LogoSpinner className="size-10" />
    </div>
  );
}
