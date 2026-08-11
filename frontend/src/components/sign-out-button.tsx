"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

// Must be a server call — JavaScript cannot clear an httpOnly cookie itself.
export function SignOutButton({ className, iconOnly }: { className?: string; iconOnly?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className={cn(
        "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-1 hover:text-text-primary disabled:opacity-50",
        className
      )}
    >
      <LogOut className="size-4 shrink-0 text-text-muted" strokeWidth={1.5} />
      {!iconOnly && <span>Sign out</span>}
    </button>
  );
}
