"use client";

import { Toast } from "@base-ui/react/toast";
import { CheckCircle2, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
};

const TONE: Record<string, string> = {
  success: "text-approved-text",
  error: "text-rejected-text",
};

function ToastList() {
  const { toasts } = Toast.useToastManager();

  return toasts.map((item) => {
    const Icon = item.type ? ICONS[item.type] : undefined;
    return (
      <Toast.Root
        key={item.id}
        toast={item}
        className="flex items-center gap-2 rounded-md border border-border-default bg-surface-2 px-3.5 py-3 text-sm text-text-primary shadow-lg data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0"
      >
        <Toast.Content className="flex items-center gap-2">
          {Icon && <Icon className={cn("size-4 shrink-0", item.type && TONE[item.type])} />}
          <Toast.Title />
        </Toast.Content>
      </Toast.Root>
    );
  });
}

// Renders the queue owned by lib/toast.ts's toastManager singleton — mount
// once inside the root layout's <ToastProvider>.
export function Toaster() {
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed inset-x-4 bottom-4 z-50 mx-auto flex w-auto max-w-sm flex-col gap-2 sm:inset-x-auto sm:right-4 sm:left-auto">
        <ToastList />
      </Toast.Viewport>
    </Toast.Portal>
  );
}
