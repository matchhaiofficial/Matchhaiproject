import { create } from "zustand";

type LoginUserType = "player" | "zone";

type LoginFormState = {
  emailOrPhone: string;
  password: string;
  userType: LoginUserType;
  setEmailOrPhone: (value: string) => void;
  setPassword: (value: string) => void;
  setUserType: (value: LoginUserType) => void;
  reset: () => void;
};

const initialState = {
  emailOrPhone: "",
  password: "",
  userType: "player" as LoginUserType,
};

export const useLoginFormStore = create<LoginFormState>()((set) => ({
  ...initialState,
  setEmailOrPhone: (emailOrPhone) => set({ emailOrPhone }),
  setPassword: (password) => set({ password }),
  setUserType: (userType) => set({ userType }),
  reset: () => set(initialState),
}));
