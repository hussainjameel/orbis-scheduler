import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  heading,
  body,
  action,
}: {
  icon?: LucideIcon;
  heading?: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-[300px] flex-col items-center py-12 text-center">
      {Icon && <Icon className="size-6 text-text-muted" strokeWidth={1.5} />}
      {heading && (
        <h2 className={cn("text-base font-medium text-text-primary", Icon && "mt-3")}>{heading}</h2>
      )}
      {body && (
        <p className={cn("text-sm text-text-secondary", heading && "mt-2")}>{body}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
