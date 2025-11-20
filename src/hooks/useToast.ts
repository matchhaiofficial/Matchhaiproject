// src/hooks/useToast.ts
import { useCallback } from "react";
import { ToastType, useToastStore } from "../store/toastStore";

type ShowToastArgs = {
  type?: ToastType;
  title?: string;
  message: string;
  duration?: number;
};

export function useToast() {
  const show = useToastStore((s) => s.showToast);
  const hide = useToastStore((s) => s.hideToast);

  // stable wrappers (good for deps in useEffect)
  const showToast = useCallback(
    (args: ShowToastArgs) => {
      show(args);
    },
    [show]
  );

  const hideToast = useCallback(() => {
    hide();
  }, [hide]);

  return { showToast, hideToast };
}
