import { Toast } from "@base-ui/react/toast";

// Module-level singleton so any Client Component can fire a toast without
// prop-drilling — passed into <ToastProvider toastManager={toastManager}>
// in the root layout so the Toaster's useToastManager() sees the same queue.
export const toastManager = Toast.createToastManager();

export const toast = {
  success: (title: string) => toastManager.add({ title, type: "success" }),
  error: (title: string) => toastManager.add({ title, type: "error" }),
};
