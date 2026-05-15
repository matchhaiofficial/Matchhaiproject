import { create } from "zustand";

type LoginUserType = "player" | "zone";

type LoginFormState = {
  emailOrPhone: string;
  password: string;
  userType: LoginUserType;
  loading: boolean;
  setEmailOrPhone: (value: string) => void;
  setPassword: (value: string) => void;
  setUserType: (value: LoginUserType) => void;
  setLoading: (value: boolean) => void;
  reset: () => void;
};

const initialState = {
  emailOrPhone: "",
  password: "",
  userType: "player" as LoginUserType,
  loading: false,
};

export const useLoginFormStore = create<LoginFormState>()((set) => ({
  ...initialState,
  setEmailOrPhone: (emailOrPhone) => set({ emailOrPhone }),
  setPassword: (password) => set({ password }),
  setUserType: (userType) => set({ userType }),
  setLoading: (loading) => set({ loading }),
  reset: () => set(initialState),
}));
