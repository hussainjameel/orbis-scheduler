"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, List, Clock, LayoutList, Share2, Settings, Menu, type LucideIcon } from "lucide-react";

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
import { cn } from "@/lib/utils";

const BOTTOM_ITEMS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Bookings", href: "/dashboard/bookings", icon: List },
  { label: "Hours", href: "/dashboard/availability", icon: Clock },
  { label: "Form", href: "/dashboard/form", icon: LayoutList },
  { label: "Share", href: "/dashboard/share", icon: Share2 },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function OwnerMobileNav() {
  const pathname = usePathname();

  return (
    <>
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
                <Link href="/dashboard" className="flex items-center gap-2">
                  <Home className="size-4 text-text-muted" strokeWidth={1.5} />
                  <span>Dashboard</span>
                </Link>
              }
            />
            <DropdownMenuItem
              render={
                <Link href="/dashboard/settings" className="flex items-center gap-2">
                  <Settings className="size-4 text-text-muted" strokeWidth={1.5} />
                  <span>Settings</span>
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

      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[56px] items-stretch border-t border-border-default bg-surface-1 sm:hidden">
        {BOTTOM_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-xs",
                active ? "text-brand" : "text-text-secondary"
              )}
            >
              <Icon className="size-5" strokeWidth={1.5} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
