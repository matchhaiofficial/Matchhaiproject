import { Id } from "./_generated/dataModel";

export type ChatUserKey = string;

export function toChatUserKey(value?: string | Id<"users"> | null): ChatUserKey {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error("User context is missing");
  }
  return normalized;
}

export function normalizeChatUserKeys(values: Array<string | Id<"users"> | null | undefined>): ChatUserKey[] {
  return Array.from(new Set(values.map((value) => toChatUserKey(value)).filter(Boolean)));
}
