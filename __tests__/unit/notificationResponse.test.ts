import { getNotificationResponseKey } from "../../src/utils/notificationResponse";

describe("notification response identity", () => {
  it("uses the Expo request identifier when available", () => {
    expect(
      getNotificationResponseKey({
        notification: { request: { identifier: "push-123", content: { data: {} } } },
      }),
    ).toBe("id:push-123");
  });

  it("creates a stable fingerprint when Expo omits the request identifier", () => {
    const first = getNotificationResponseKey({
      actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
      notification: {
        date: 123,
        request: {
          content: {
            title: "MatchHai",
            body: "New request",
            data: { type: "booking.counter_offer", requestId: "req-1" },
          },
        },
      },
    });
    const second = getNotificationResponseKey({
      actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
      notification: {
        date: 123,
        request: {
          content: {
            title: "MatchHai",
            body: "New request",
            data: { requestId: "req-1", type: "booking.counter_offer" },
          },
        },
      },
    });

    expect(first).toBe(second);
    expect(first).toContain("fingerprint:");
  });

  it("rejects an empty restored response", () => {
    expect(getNotificationResponseKey({})).toBeNull();
  });
});
