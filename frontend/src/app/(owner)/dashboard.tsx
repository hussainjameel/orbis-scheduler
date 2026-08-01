// src/app/(owner)/dashboard/loading.tsx
import { LogoSpinner } from "@/components/logo";

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <LogoSpinner className="size-8" />
    </div>
  );
}