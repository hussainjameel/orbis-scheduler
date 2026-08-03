"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  List,
  Clock,
  LayoutList,
  Share2,
  Settings,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { Logo, LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "orbis-sidebar-collapsed";

const NAV_ITEMS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Bookings", href: "/dashboard/bookings", icon: List },
  { label: "Availability", href: "/dashboard/availability", icon: Clock },
  { label: "Booking form", href: "/dashboard/form", icon: LayoutList },
  { label: "Share & embed", href: "/dashboard/share", icon: Share2 },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function OwnerSidebar({
  businessName,
  ownerEmail,
  pendingCount,
}: {
  businessName: string;
  ownerEmail: string;
  pendingCount: number;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Read the persisted choice after mount — first paint may briefly show
  // expanded before correcting. Accepted for now, per the task. Must run in
  // an effect (not a lazy initial state) since localStorage isn't available
  // during the server render this component hydrates from.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const initial = businessName.charAt(0).toUpperCase();

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border-default bg-surface-1 py-4 transition-[width] duration-base sm:flex",
          collapsed ? "w-[56px] items-center px-2" : "w-[180px] px-3"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center", collapsed ? "justify-center" : "px-2")}>
          {collapsed ? <LogoMark className="size-6 text-brand" /> : <Logo />}
        </div>

        {/* Nav */}
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const showBadge = item.label === "Bookings" && pendingCount > 0;

            const row = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center rounded-sm transition-colors",
                  collapsed ? "mx-auto size-10 justify-center" : "gap-2 px-2 py-2 text-base",
                  active ? "bg-brand-subtle font-medium text-text-primary" : "text-text-secondary hover:bg-surface-2"
                )}
              >
                <Icon
                  className={cn("size-5 shrink-0", active ? "text-brand" : "text-text-muted")}
                  strokeWidth={1.5}
                />
                {!collapsed && <span className="flex-1">{item.label}</span>}
                {!collapsed && showBadge && (
                  <span className="rounded-full bg-pending px-1.5 text-xs text-pending-text">
                    {pendingCount}
                  </span>
                )}
                {collapsed && showBadge && (
                  <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-pending-text" />
                )}
              </Link>
            );

            if (!collapsed) return row;

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={row} />
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        {collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Expand sidebar"
            className="flex items-center justify-center rounded-sm py-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary"
          >
            <ChevronRight className="size-4" strokeWidth={1.5} />
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-2"
          >
            <ChevronLeft className="size-4 shrink-0 text-text-muted" strokeWidth={1.5} />
            <span>Collapse</span>
          </button>
        )}

        <div className="my-3 h-px bg-border-default" />

        {/* Identity */}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <div className="flex size-8 items-center justify-center rounded-full bg-text-primary text-xs font-medium text-surface-0">
                  {initial}
                </div>
              }
            />
            <TooltipContent side="right">
              {businessName} · {ownerEmail}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="px-2">
            <p className="truncate text-sm font-medium text-text-primary">{businessName}</p>
            <p className="truncate text-xs text-text-muted">{ownerEmail}</p>
          </div>
        )}

        <div className={cn("mt-3 flex flex-col gap-1", collapsed && "items-center")}>
          <ThemeToggle
            iconOnly={collapsed}
            className={cn("[&>svg]:size-5", !collapsed && "px-2 py-2 text-base")}
          />
          <SignOutButton
            iconOnly={collapsed}
            className={cn("[&>svg]:size-5", !collapsed && "px-2 py-2 text-base")}
          />
        </div>
      </aside>
    </TooltipProvider>
  );
}
