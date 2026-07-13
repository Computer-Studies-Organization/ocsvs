export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

class ToastStore {
  private _list = $state<Toast[]>([]);
  private _counter = 0;

  get list() {
    return this._list;
  }

  addToast = (type: ToastType, message: string, duration?: number) => {
    const id = `toast-${++this._counter}`;
    const toast: Toast = {
      id,
      type,
      message,
      duration: duration ?? (type === "error" ? undefined : 4000),
    };

    const next = [...this._list, toast];
    this._list = next.length > 3 ? next.slice(-3) : next;

    if (toast.duration) {
      setTimeout(() => this.dismissToast(id), toast.duration);
    }

    return id;
  };

  dismissToast = (id: string) => {
    this._list = this._list.filter((t) => t.id !== id);
  };
}

export const toasts = new ToastStore();
export const addToast = toasts.addToast;
export const dismissToast = toasts.dismissToast;
