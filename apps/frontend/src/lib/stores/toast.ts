import { writable } from "svelte/store";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  let counter = 0;

  function addToast(type: ToastType, message: string, duration?: number) {
    const id = `toast-${++counter}`;
    const toast: Toast = {
      id,
      type,
      message,
      duration: duration ?? (type === "error" ? undefined : 4000),
    };

    update((toasts) => {
      const next = [...toasts, toast];
      // Keep max 3 visible — remove oldest if over
      return next.length > 3 ? next.slice(-3) : next;
    });

    // Auto-dismiss if duration set
    if (toast.duration) {
      setTimeout(() => dismissToast(id), toast.duration);
    }

    return id;
  }

  function dismissToast(id: string) {
    update((toasts) => toasts.filter((t) => t.id !== id));
  }

  return { subscribe, addToast, dismissToast };
}

export const toasts = createToastStore();
export const { addToast, dismissToast } = toasts;
