export const FEATURE_READINESS = {
  payments: {
    wallet: {
      enabled: true,
      label: "MatchHai Wallet",
    },
    easypaisa: {
      enabled: true,
      label: "Easypaisa",
      description:
        "Start an Easypaisa payment directly from MatchHai. Mobile Account is the default flow, with OTC available when explicitly enabled.",
    },
    card: {
      enabled: false,
      label: "Direct Card Entry",
      unavailableMessage:
        "Direct in-app card entry is not available. Use Easypaisa instead.",
      statusText: "Use Easypaisa",
      rolloutNote:
        "MatchHai Wallet and Easypaisa are live payment options.",
      walletOnlyInfo:
        "Use MatchHai Wallet for instant payments or Easypaisa for direct mobile-account payments.",
    },
  },
} as const;

export function getUnavailablePaymentMessage(method: "wallet" | "card") {
  if (method === "card") {
    return FEATURE_READINESS.payments.card.unavailableMessage;
  }

  return "This payment method is not available.";
}
