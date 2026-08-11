"use client";

import type { ReactNode } from "react";
import { Toast } from "@base-ui/react/toast";
import { toastManager } from "@/lib/toast";

// A Server Component can't pass toastManager (an object of functions) as a
// prop into a Client Component — RSC props must serialize. This wrapper
// instantiates the Provider itself, client-side, closing over the singleton.
export function AppToastProvider({ children }: { children: ReactNode }) {
  return <Toast.Provider toastManager={toastManager}>{children}</Toast.Provider>;
}
