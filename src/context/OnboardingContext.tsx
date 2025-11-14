import React, { createContext, useContext, useMemo, useState } from 'react';

export type OnboardingProfile = {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  karachiArea: string | null;
  selectedGames: string[];
};

type OnboardingContextValue = {
  profile: OnboardingProfile;
  updateOnboardingProfile: (patch: Partial<OnboardingProfile>) => void;
  resetOnboarding: () => void;
};

const defaultProfile: OnboardingProfile = {
  fullName: '',
  username: '',
  email: '',
  phone: '',
  password: '',
  karachiArea: null,
  selectedGames: [],
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<OnboardingProfile>(defaultProfile);

  const updateOnboardingProfile = (patch: Partial<OnboardingProfile>) => {
    setProfile(prev => ({ ...prev, ...patch }));
  };

  const resetOnboarding = () => {
    setProfile(defaultProfile);
  };

  const value = useMemo(
    () => ({ profile, updateOnboardingProfile, resetOnboarding }),
    [profile]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return ctx;
}
