"use client";

import Link from "next/link";
import { Home, Building2, Menu } from "lucide-react";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// No bottom tab bar, unlike owner-mobile-nav.tsx — with only 2 nav items
// (vs owner's 6) a 4-slot bottom bar is disproportionate; both fit in the
// header dropdown. Keeps mobile "not broken" without extra chrome, matching
// admin's mobile-tolerant (not mobile-optimized) scope.
export function AdminMobileNav() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border-default bg-surface-1 px-4 sm:hidden">
      <Logo />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Menu"
              className="flex size-11 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-2"
            >
              <Menu className="size-5" strokeWidth={1.5} />
            </button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={
              <Link href="/admin" className="flex items-center gap-2">
                <Home className="size-4 text-text-muted" strokeWidth={1.5} />
                <span>Overview</span>
              </Link>
            }
          />
          <DropdownMenuItem
            render={
              <Link href="/admin/businesses" className="flex items-center gap-2">
                <Building2 className="size-4 text-text-muted" strokeWidth={1.5} />
                <span>Businesses</span>
              </Link>
            }
          />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            render={<ThemeToggle className="w-full justify-start px-1.5 py-1 text-sm" />}
          />
          <DropdownMenuItem
            render={<SignOutButton className="w-full justify-start px-1.5 py-1 text-sm" />}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
