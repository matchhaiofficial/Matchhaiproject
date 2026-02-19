export type WalletTotals = {
  totalSpent: number;
  pendingAmount: number;
  paidCount: number;
  pendingCount: number;
};

type WalletIntentLike = {
  paymentStatus?: string | null;
  pricing?: {
    total?: number | null;
  } | null;
};

export function calculateWalletTotals(intents: WalletIntentLike[]): WalletTotals {
  const safeIntents = Array.isArray(intents) ? intents : [];

  const paid = safeIntents.filter((item) => item?.paymentStatus === "paid");
  const pending = safeIntents.filter((item) => item?.paymentStatus !== "paid");

  const totalSpent = paid.reduce((acc, item) => acc + Number(item?.pricing?.total || 0), 0);
  const pendingAmount = pending.reduce((acc, item) => acc + Number(item?.pricing?.total || 0), 0);

  return {
    totalSpent,
    pendingAmount,
    paidCount: paid.length,
    pendingCount: pending.length,
  };
}
