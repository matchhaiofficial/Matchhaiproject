import { Alert } from "react-native";

type AlertButtonStyle = "default" | "cancel" | "destructive";

type ConfirmOptions = {
  cancelText: string;
  cancelable?: boolean;
  confirmStyle?: Extract<AlertButtonStyle, "default" | "destructive">;
  confirmText: string;
  message?: string;
  title: string;
};

type ChooseOption<Key extends string> = {
  key: Key;
  style?: Extract<AlertButtonStyle, "default" | "destructive">;
  text: string;
};

type ChooseOptions<Key extends string> = {
  cancelText: string;
  cancelable?: boolean;
  choices: ChooseOption<Key>[];
  message?: string;
  title: string;
};

export function confirm({
  cancelText,
  cancelable,
  confirmStyle = "default",
  confirmText,
  message,
  title,
}: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: "cancel", onPress: () => resolve(false) },
        { text: confirmText, style: confirmStyle, onPress: () => resolve(true) },
      ],
      {
        cancelable,
        onDismiss: () => resolve(false),
      },
    );
  });
}

export function choose<Key extends string>({
  cancelText,
  cancelable,
  choices,
  message,
  title,
}: ChooseOptions<Key>): Promise<Key | null> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: "cancel", onPress: () => resolve(null) },
        ...choices.map((choice) => ({
          text: choice.text,
          style: choice.style ?? "default",
          onPress: () => resolve(choice.key),
        })),
      ],
      {
        cancelable,
        onDismiss: () => resolve(null),
      },
    );
  });
}
