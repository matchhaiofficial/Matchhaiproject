function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = stableValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

export function getNotificationResponseKey(response: any) {
  const request = response?.notification?.request;
  const data = request?.content?.data || {};
  const identifier = String(
    request?.identifier ||
    data?.reminderKey ||
    data?.notificationId ||
    "",
  ).trim();
  if (identifier) return `id:${identifier}`;

  const content = request?.content || {};
  const fingerprint = {
    actionIdentifier: String(response?.actionIdentifier || "").trim(),
    date: response?.notification?.date || null,
    title: String(content?.title || "").trim(),
    body: String(content?.body || "").trim(),
    data: stableValue(data),
  };
  const serialized = JSON.stringify(fingerprint);
  return serialized === JSON.stringify({
    actionIdentifier: "",
    date: null,
    title: "",
    body: "",
    data: {},
  })
    ? null
    : `fingerprint:${serialized}`;
}
