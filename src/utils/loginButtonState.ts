type LoginButtonStateInput = {
  isIdentifierValid: boolean;
  hasPassword: boolean;
  loading: boolean;
  isLockedOut: boolean;
};

export function getLoginButtonState(input: LoginButtonStateInput) {
  const hasValidCredentials = input.isIdentifierValid && input.hasPassword;
  return {
    canSubmit: hasValidCredentials && !input.loading && !input.isLockedOut,
    showActiveStyle: hasValidCredentials && !input.isLockedOut,
  };
}
