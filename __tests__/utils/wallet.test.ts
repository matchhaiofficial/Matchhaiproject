import { calculateWalletTotals } from "../../src/utils/wallet";

describe("wallet utils", () => {
  it("calculates totals and counts", () => {
    const intents = [
      { paymentStatus: "paid", pricing: { total: 500 } },
      { paymentStatus: "paid", pricing: { total: 1500 } },
      { paymentStatus: "unpaid", pricing: { total: 700 } },
    ];

    const totals = calculateWalletTotals(intents);
    expect(totals.totalSpent).toBe(2000);
    expect(totals.pendingAmount).toBe(700);
    expect(totals.paidCount).toBe(2);
    expect(totals.pendingCount).toBe(1);
  });

  it("handles empty or missing data", () => {
    const totals = calculateWalletTotals([
      { paymentStatus: "paid" },
      {},
    ]);
    expect(totals.totalSpent).toBe(0);
    expect(totals.pendingAmount).toBe(0);
    expect(totals.paidCount).toBe(1);
    expect(totals.pendingCount).toBe(1);
  });
});
