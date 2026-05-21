// src/hooks/useToast.ts
import { useCallback } from "react";
import Toast from "react-native-toast-message";
import { sanitizeToastMessage } from "../utils/userFacingErrors";

type ToastType = "success" | "error" | "info" | "warning" | "delete";

interface ShowToastOptions {
  type?: ToastType;
  title?: string;
  message: string;
}

export function useToast() {
  const showToast = useCallback(
    ({ type = "info", title, message }: ShowToastOptions) => {
      let mappedType: string = type;

      // Map app types to toastConfig keys
      if (type === "info") {
        mappedType = "success"; // map info to success variant
      }
      if (type === "warning") {
        mappedType = "warning"; // use dedicated warning variant
      }
      if (type === "delete") {
        mappedType = "delete";
      }

      Toast.show({
        type: mappedType, // "success" | "error" | "warning" | "delete"
        text1: title,
        text2: sanitizeToastMessage(message),
        visibilityTime: 3500,
        autoHide: true,
        position: "bottom",
      });
    },
    []
  );

  const hideToast = useCallback(() => {
    Toast.hide();
  }, []);

  return { showToast, hideToast };
}
