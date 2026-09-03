/** Shared monitoring types. Kept dependency-free so the adapter + core agree. */

export type MonitorLevel = "fatal" | "error" | "warning" | "info" | "debug";

/** Arbitrary context attached to a capture. Will be redacted before send. */
export type MonitorContext = Record<string, unknown>;

/** Only an opaque id is ever stored — never PII. */
export type MonitorUser = {
  /** Stable user id or a hash. Never an email/phone/CNIC. */
  id: string;
};
