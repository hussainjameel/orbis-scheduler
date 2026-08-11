import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// No 'use client' — plain presentational markup, so it renders identically
// whether the Server Component page uses it directly (no token in the URL)
// or the Client Component form swaps to it (backend 400: invalid/expired).
export function InvalidResetLink() {
  return (
    <div className="text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-rejected">
        <AlertCircle className="size-6 text-rejected-text" />
      </div>
      <h1 className="mt-4 text-xl font-medium text-text-primary">
        This link is no longer valid
      </h1>
      <p className="mx-auto mt-2 max-w-[320px] text-sm text-text-secondary">
        Reset links expire after one hour and can only be used once. Request a
        new one to continue.
      </p>
      <Link href="/forgot-password" className={cn(buttonVariants(), "mt-6")}>
        Request a new link
      </Link>
    </div>
  );
}
