// src/store/toastStore.ts
import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

type ToastState = {
  visible: boolean;
  type: ToastType;
  title?: string;
  message?: string;
  timeoutId?: ReturnType<typeof setTimeout> | null;
  showToast: (opts: {
    type?: ToastType;
    title?: string;
    message: string;
    duration?: number;
  }) => void;
  hideToast: () => void;
};

export const useToastStore = create<ToastState>((set, get) => ({
  visible: false,
  type: "info",
  title: undefined,
  message: undefined,
  timeoutId: undefined,

  showToast: ({ type = "info", title, message, duration = 3500 }) => {
    const existing = get().timeoutId;
    if (existing) {
      clearTimeout(existing);
    }

    const id = setTimeout(() => {
      set({ visible: false, timeoutId: undefined });
    }, duration);

    set({
      visible: true,
      type,
      title,
      message,
      timeoutId: id,
    });
  },

  hideToast: () => {
    const existing = get().timeoutId;
    if (existing) clearTimeout(existing);
    set({ visible: false, timeoutId: undefined });
  },
}));
