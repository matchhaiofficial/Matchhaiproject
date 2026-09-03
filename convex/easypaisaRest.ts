export type EasypaisaTransactionType = "MA" | "OTC";

export function getEasypaisaRestBaseUrl(env: string, override?: string | null) {
  const normalizedOverride = String(override || "").trim();
  if (normalizedOverride) {
    return normalizedOverride.replace(/\/$/, "");
  }

  return env === "production"
    ? "https://easypay.easypaisa.com.pk/easypay-service/rest/v4"
    : "https://easypaystg.easypaisa.com.pk/easypay-service/rest/v4";
}

export function buildCredentialsHeader(username: string, password: string) {
  return Buffer.from(`${username}:${password}`, "utf8").toString("base64");
}

export function maskPhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 4) return "*".repeat(digits.length);
  return `${digits.slice(0, 2)}${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-2)}`;
}

export function sanitizeRestPayload(payload: Record<string, unknown>) {
  const cloned = { ...payload };

  if ("mobileAccountNo" in cloned) {
    cloned.mobileAccountNo = maskPhone(String(cloned.mobileAccountNo || ""));
  }
  if ("msisdn" in cloned) {
    cloned.msisdn = maskPhone(String(cloned.msisdn || ""));
  }
  if ("accountNum" in cloned) {
    cloned.accountNum = maskPhone(String(cloned.accountNum || ""));
  }

  return cloned;
}
