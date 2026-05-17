import { v } from "convex/values";

import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

const EMBEDDING_DIMENSIONS = 384;
const DEFAULT_EMBEDDING_MODEL = "@cf/baai/bge-small-en-v1.5";

const roleScopeValidator = v.union(
  v.literal("player"),
  v.literal("zone_admin"),
  v.literal("super_admin"),
  v.literal("all"),
);
const localeValidator = v.union(v.literal("en"), v.literal("ur"), v.literal("mixed"));
const sourceTypeValidator = v.union(
  v.literal("markdown"),
  v.literal("manual"),
  v.literal("policy"),
  v.literal("faq"),
  v.literal("internal"),
);

type RoleScope = "player" | "zone_admin" | "super_admin" | "all";
type Locale = "en" | "ur" | "mixed";
type SourceType = "markdown" | "manual" | "policy" | "faq" | "internal";

function normalizeEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase();
}

function normalizeSlug(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function getSuperAdminEmails() {
  const values = [
    process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL,
    process.env.SUPER_ADMIN_EMAIL_JUNAID,
    process.env.SUPER_ADMIN_EMAIL_EHTESHAN,
    process.env.SUPER_ADMIN_EMAIL_ZEERAK,
    process.env.SUPER_ADMIN_EMAIL_MUBEEN,
    process.env.SUPER_ADMIN_EMAIL_SAAD,
    process.env.SUPER_ADMIN_EMAIL_OVAIS,
    ...(process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAILS || "").split(","),
  ];
  return new Set(values.map(normalizeEmail).filter(Boolean));
}

function requireKnowledgeIngestKey(ingestKey: string) {
  const expected = String(process.env.SUPPORT_KNOWLEDGE_INGEST_KEY || "").trim();
  if (!expected) throw new Error("SUPPORT_KNOWLEDGE_INGEST_KEY is not configured");
  if (String(ingestKey || "") !== expected) throw new Error("Invalid knowledge ingest key");
}

function isSuperAdminProfile(profile: any, email?: string | null) {
  return profile?.role === "super-admin" || getSuperAdminEmails().has(normalizeEmail(email || profile?.email));
}

async function requireSupportKnowledgeAdmin(ctx: any) {
  let authUser: any = null;
  try {
    authUser = await authComponent.getAuthUser(ctx);
  } catch {
    authUser = null;
  }
  const authId = String(authUser?.userId || authUser?._id || authUser?.id || "").trim();
  const profile = authId
    ? await ctx.db.query("users").withIndex("by_authId", (q: any) => q.eq("authId", authId)).unique()
    : null;
  if (!isSuperAdminProfile(profile, authUser?.email)) {
    throw new Error("Super admin access required");
  }
  return { authUser, profile };
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16)}:${value.length}`;
}

function redactKnowledgeText(input: string) {
  return String(input || "")
    .replace(/\b(?:otp|pin|password|token|secret|api[_\s-]?key|hash[_\s-]?key)\s*[:=]\s*[A-Z0-9@#$%^&*._/-]{3,}\b/gi, "[redacted-secret]")
    .replace(/\b\d{5}[-\s]?\d{7}[-\s]?\d\b/g, "[redacted-cnic]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[redacted-card]")
    .replace(/\b(?:\+?92|0)?3[0-9][\s-]?[0-9]{3}[\s-]?[0-9]{4}\b/g, "[redacted-phone]")
    .replace(/\b(?:EP|TXN|TRX|PAY|ORD|REF)[-_]?(?=[A-Z0-9-]*\d)[A-Z0-9-]{6,}\b/gi, "[redacted-reference]");
}

function normalizeKnowledgeText(input: string) {
  return redactKnowledgeText(input)
    .replace(/\r\n/g, "\n")
    .replace(/â€”/g, "-")
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€�/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkText(content: string, maxChars: number, overlapChars: number) {
  const safeMax = Math.min(Math.max(maxChars || 1800, 800), 3200);
  const safeOverlap = Math.min(Math.max(overlapChars || 160, 0), 400);
  const sections = normalizeKnowledgeText(content)
    .split(/\n(?=##\s+)/g)
    .map((section) => section.trim())
    .filter(Boolean);
  const chunks: Array<{ title: string; text: string }> = [];
  for (const section of sections.length ? sections : [normalizeKnowledgeText(content)]) {
    const title = (section.match(/^##\s+(.+)$/m)?.[1] || "Matchhai support knowledge").trim().slice(0, 160);
    let cursor = 0;
    while (cursor < section.length) {
      const slice = section.slice(cursor, cursor + safeMax);
      const boundary = slice.length === safeMax ? Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". ")) : -1;
      const end = boundary > safeMax * 0.55 ? cursor + boundary + 1 : cursor + slice.length;
      const text = section.slice(cursor, end).trim();
      if (text.length >= 80) chunks.push({ title, text });
      if (end >= section.length) break;
      cursor = Math.max(end - safeOverlap, cursor + 1);
    }
  }
  return chunks.slice(0, 500);
}

async function createEmbedding(text: string) {
  const accountId = String(process.env.SUPPORT_EMBEDDING_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const apiToken = String(process.env.SUPPORT_EMBEDDING_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "").trim();
  const model = String(process.env.SUPPORT_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL).trim();
  if (!accountId || !apiToken) throw new Error("Cloudflare Workers AI embedding credentials are not configured");
  // Cloudflare expects model names like "@cf/baai/bge-small-en-v1.5" with the "/" intact (do not encode "/").
  const modelPath = encodeURI(model);
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: [normalizeKnowledgeText(text).slice(0, 12000)],
    }),
  });
  if (!response.ok) {
    let details = "";
    try {
      details = JSON.stringify(await response.json());
    } catch {
      try {
        details = await response.text();
      } catch {
        details = "";
      }
    }
    throw new Error(
      `Cloudflare Workers AI embedding request failed (${response.status} ${response.statusText})${details ? `: ${details}` : ""}`,
    );
  }
  const payload = (await response.json()) as any;
  const embedding = payload?.result?.data?.[0] || payload?.data?.[0] || payload?.result?.data;
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error("Cloudflare embedding dimensions do not match the Convex vector index");
  }
  return embedding.map(Number);
}

async function signSupportPayload(payloadBase64: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadBase64));
  return bytesToBase64Url(new Uint8Array(signature));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function verifySignedSupportToken(token: string) {
  const secret = String(process.env.SUPPORT_AI_SHARED_SECRET || "").trim();
  if (!secret) throw new Error("Support AI shared secret is not configured");
  const [payloadBase64, signature] = String(token || "").split(".");
  if (!payloadBase64 || !signature) throw new Error("Invalid support token");
  const expected = await signSupportPayload(payloadBase64, secret);
  if (expected !== signature) throw new Error("Invalid support token");
  const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadBase64)));
  if (!payload?.expMs || Number(payload.expMs) <= Date.now()) throw new Error("Expired support token");
  return payload;
}

function normalizeSupportRole(value: unknown): RoleScope {
  if (value === "zone_admin" || value === "super_admin") return value;
  return "player";
}

export const upsertDocument = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    category: v.string(),
    roleScope: roleScopeValidator,
    locale: localeValidator,
    sourceType: sourceTypeValidator,
    contentHash: v.optional(v.string()),
    content: v.optional(v.string()),
    sourceLabel: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<any> => {
    await requireSupportKnowledgeAdmin(ctx);
    const now = Date.now();
    const slug = normalizeSlug(args.slug || args.title);
    if (!slug) throw new Error("Document slug is required");
    const contentHash = args.contentHash || hashText(args.content || `${args.title}:${args.category}:${now}`);
    const existing = await ctx.db.query("supportKnowledgeDocuments").withIndex("by_slug", (q: any) => q.eq("slug", slug)).unique();
    const patch = {
      title: args.title.trim().slice(0, 180),
      slug,
      category: args.category.trim().slice(0, 80),
      roleScope: args.roleScope,
      locale: args.locale,
      sourceType: args.sourceType,
      contentHash,
      sourceLabel: args.sourceLabel ? args.sourceLabel.trim().slice(0, 180) : undefined,
      isActive: args.isActive !== false,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return { documentId: existing._id, created: false };
    }
    const documentId = await ctx.db.insert("supportKnowledgeDocuments", {
      ...patch,
      createdAt: now,
    });
    return { documentId, created: true };
  },
});

export const listDocuments = query({
  args: {
    activeOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSupportKnowledgeAdmin(ctx);
    const limit = Math.min(Math.max(args.limit || 50, 1), 100);
    const rows = args.activeOnly === false
      ? await ctx.db.query("supportKnowledgeDocuments").order("desc").take(limit)
      : await ctx.db.query("supportKnowledgeDocuments").withIndex("by_isActive", (q: any) => q.eq("isActive", true)).order("desc").take(limit);
    return rows.map((row) => ({
      documentId: row._id,
      title: row.title,
      slug: row.slug,
      category: row.category,
      roleScope: row.roleScope,
      locale: row.locale,
      sourceType: row.sourceType,
      sourceLabel: row.sourceLabel || row.title,
      contentHash: row.contentHash,
      isActive: row.isActive,
      updatedAt: row.updatedAt,
    }));
  },
});

export const deactivateDocument = mutation({
  args: { documentId: v.id("supportKnowledgeDocuments") },
  handler: async (ctx, args) => {
    await requireSupportKnowledgeAdmin(ctx);
    const now = Date.now();
    await ctx.db.patch(args.documentId, { isActive: false, updatedAt: now });
    const chunks = await ctx.db
      .query("supportKnowledgeChunks")
      .withIndex("by_documentId", (q: any) => q.eq("documentId", args.documentId))
      .take(500);
    for (const chunk of chunks) {
      await ctx.db.patch(chunk._id, { isActive: false, updatedAt: now });
    }
    return { ok: true, deactivatedChunks: chunks.length };
  },
});

export const chunkDocument = action({
  args: {
    documentId: v.id("supportKnowledgeDocuments"),
    content: v.string(),
    chunkSize: v.optional(v.number()),
    overlap: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; chunkCount: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    const isAdmin: boolean = await ctx.runQuery((internal as any).supportKnowledge.isAdminFromIdentity, {
      subject: identity?.subject || "",
      tokenIdentifier: identity?.tokenIdentifier || "",
      email: identity?.email || "",
    });
    if (!isAdmin) throw new Error("Super admin access required");
    const document: any = await ctx.runQuery((internal as any).supportKnowledge.getDocumentById, {
      documentId: args.documentId,
    });
    if (!document) throw new Error("Knowledge document not found");
    const rawChunks = chunkText(args.content, args.chunkSize || 1800, args.overlap || 160);
    const chunks = [];
    for (let index = 0; index < rawChunks.length; index += 1) {
      const chunk = rawChunks[index];
      chunks.push({
        chunkIndex: index,
        title: chunk.title || document.title,
        chunkText: chunk.text,
        embedding: await createEmbedding(chunk.text),
      });
    }
    await ctx.runMutation((internal as any).supportKnowledge.replaceDocumentChunks, {
      documentId: args.documentId,
      chunks,
    });
    return { ok: true, chunkCount: chunks.length };
  },
});

export const ingestDocumentWithKey = action({
  args: {
    ingestKey: v.string(),
    title: v.string(),
    slug: v.string(),
    category: v.string(),
    roleScope: roleScopeValidator,
    locale: localeValidator,
    sourceType: sourceTypeValidator,
    sourceLabel: v.optional(v.string()),
    content: v.string(),
    chunkSize: v.optional(v.number()),
    overlap: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; documentId: Id<"supportKnowledgeDocuments">; chunkCount: number }> => {
    requireKnowledgeIngestKey(args.ingestKey);
    const cleanContent = normalizeKnowledgeText(args.content);
    if (cleanContent.length < 80) throw new Error("Knowledge content is too short");
    const documentId: Id<"supportKnowledgeDocuments"> = await ctx.runMutation((internal as any).supportKnowledge.upsertDocumentForIngest, {
      title: args.title,
      slug: args.slug,
      category: args.category,
      roleScope: args.roleScope,
      locale: args.locale,
      sourceType: args.sourceType,
      sourceLabel: args.sourceLabel,
      contentHash: hashText(cleanContent),
      isActive: true,
    });
    const rawChunks = chunkText(cleanContent, args.chunkSize || 1800, args.overlap || 160);
    const chunks = [];
    for (let index = 0; index < rawChunks.length; index += 1) {
      const chunk = rawChunks[index];
      chunks.push({
        chunkIndex: index,
        title: chunk.title || args.title,
        chunkText: chunk.text,
        embedding: await createEmbedding(chunk.text),
      });
    }
    await ctx.runMutation((internal as any).supportKnowledge.replaceDocumentChunks, {
      documentId,
      chunks,
    });
    return { ok: true, documentId, chunkCount: chunks.length };
  },
});

export const embedChunk = action({
  args: {
    chunkId: v.id("supportKnowledgeChunks"),
  },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    const isAdmin: boolean = await ctx.runQuery((internal as any).supportKnowledge.isAdminFromIdentity, {
      subject: identity?.subject || "",
      tokenIdentifier: identity?.tokenIdentifier || "",
      email: identity?.email || "",
    });
    if (!isAdmin) throw new Error("Super admin access required");
    const chunk: any = await ctx.runQuery((internal as any).supportKnowledge.getChunkById, { chunkId: args.chunkId });
    if (!chunk) throw new Error("Knowledge chunk not found");
    const embedding = await createEmbedding(chunk.chunkText);
    await ctx.runMutation((internal as any).supportKnowledge.updateChunkEmbedding, { chunkId: args.chunkId, embedding });
    return { ok: true };
  },
});

export const searchKnowledge: any = action({
  args: {
    query: v.string(),
    roleScope: v.optional(roleScopeValidator),
    locale: v.optional(localeValidator),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");
    const derivedRole: RoleScope = await ctx.runQuery((internal as any).supportKnowledge.getRoleFromIdentity, {
      subject: identity?.subject || "",
      tokenIdentifier: identity?.tokenIdentifier || "",
      email: identity?.email || "",
    });
    const role: RoleScope = derivedRole === "super_admin" && args.roleScope && args.roleScope !== "all"
      ? args.roleScope
      : derivedRole;
    return await runKnowledgeSearch(ctx, {
      query: args.query,
      role,
      locale: args.locale,
      category: args.category,
      limit: args.limit,
      requestId: "direct_search",
    });
  },
});

export const searchKnowledgeForAgent = internalAction({
  args: {
    requestId: v.string(),
    identityToken: v.string(),
    query: v.string(),
    locale: v.optional(localeValidator),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const payload = await verifySignedSupportToken(args.identityToken);
    const role = normalizeSupportRole(payload.module);
    const result = await runKnowledgeSearch(ctx, {
      query: args.query,
      role,
      locale: args.locale,
      category: args.category,
      limit: args.limit,
      requestId: args.requestId,
      userId: payload.userId,
      conversationId: payload.conversationId,
    });
    return result;
  },
});

async function runKnowledgeSearch(ctx: any, input: {
  query: string;
  role: RoleScope;
  locale?: Locale;
  category?: string;
  limit?: number;
  requestId: string;
  userId?: Id<"users">;
  conversationId?: Id<"supportConversations">;
}): Promise<any> {
  const queryText = normalizeKnowledgeText(input.query).slice(0, 1200);
  if (!queryText) return { ok: true, chunks: [] };
  const limit = Math.min(Math.max(input.limit || 5, 1), 8);
  const embedding = await createEmbedding(queryText);
  const vectorResults = await ctx.vectorSearch("supportKnowledgeChunks", "by_embedding", {
    vector: embedding,
    limit: Math.min(limit * 4, 32),
    filter: (q: any) => q.eq("isActive", true),
  });
  const chunks: any[] = await ctx.runQuery((internal as any).supportKnowledge.hydrateSearchResults, {
    results: vectorResults.map((result: any) => ({ chunkId: result._id, score: result._score })),
    roleScope: input.role,
    locale: input.locale,
    category: input.category,
    limit,
  });
  if (input.userId) {
    await ctx.runMutation((internal as any).supportKnowledge.insertKnowledgeAuditLog, {
      requestId: input.requestId,
      userId: input.userId,
      conversationId: input.conversationId,
      actionType: "search_support_knowledge",
      actionStatus: "executed",
      reasonCategory: input.category || "rag_retrieval",
    });
  }
  return { ok: true, chunks };
}

export const isAdminFromIdentity = internalQuery({
  args: {
    subject: v.string(),
    tokenIdentifier: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const candidates = [args.tokenIdentifier, args.subject].filter(Boolean);
    for (const authId of candidates) {
      const profile = await ctx.db.query("users").withIndex("by_authId", (q: any) => q.eq("authId", authId)).unique();
      if (isSuperAdminProfile(profile, args.email)) return true;
    }
    return getSuperAdminEmails().has(normalizeEmail(args.email));
  },
});

export const getRoleFromIdentity = internalQuery({
  args: {
    subject: v.string(),
    tokenIdentifier: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args): Promise<RoleScope> => {
    const candidates = [args.tokenIdentifier, args.subject].filter(Boolean);
    for (const authId of candidates) {
      const profile = await ctx.db.query("users").withIndex("by_authId", (q: any) => q.eq("authId", authId)).unique();
      if (!profile) continue;
      if (isSuperAdminProfile(profile, args.email)) return "super_admin";
      if (profile.accountType === "zone") return "zone_admin";
      return "player";
    }
    return getSuperAdminEmails().has(normalizeEmail(args.email)) ? "super_admin" : "player";
  },
});

export const getDocumentById = internalQuery({
  args: { documentId: v.id("supportKnowledgeDocuments") },
  handler: async (ctx, args) => await ctx.db.get(args.documentId),
});

export const getChunkById = internalQuery({
  args: { chunkId: v.id("supportKnowledgeChunks") },
  handler: async (ctx, args) => await ctx.db.get(args.chunkId),
});

export const upsertDocumentForIngest = internalMutation({
  args: {
    title: v.string(),
    slug: v.string(),
    category: v.string(),
    roleScope: roleScopeValidator,
    locale: localeValidator,
    sourceType: sourceTypeValidator,
    sourceLabel: v.optional(v.string()),
    contentHash: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"supportKnowledgeDocuments">> => {
    const now = Date.now();
    const slug = normalizeSlug(args.slug || args.title);
    if (!slug) throw new Error("Document slug is required");
    const existing = await ctx.db.query("supportKnowledgeDocuments").withIndex("by_slug", (q: any) => q.eq("slug", slug)).unique();
    const patch = {
      title: args.title.trim().slice(0, 180),
      slug,
      category: args.category.trim().slice(0, 80),
      roleScope: args.roleScope,
      locale: args.locale,
      sourceType: args.sourceType,
      contentHash: args.contentHash,
      sourceLabel: args.sourceLabel ? args.sourceLabel.trim().slice(0, 180) : undefined,
      isActive: args.isActive,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("supportKnowledgeDocuments", {
      ...patch,
      createdAt: now,
    });
  },
});

export const hydrateSearchResults = internalQuery({
  args: {
    results: v.array(v.object({
      chunkId: v.id("supportKnowledgeChunks"),
      score: v.number(),
    })),
    roleScope: roleScopeValidator,
    locale: v.optional(localeValidator),
    category: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const allowedRoles = new Set<RoleScope>(["all", args.roleScope]);
    const chunks = [];
    for (const result of args.results) {
      const chunk = await ctx.db.get(result.chunkId);
      if (!chunk || !chunk.isActive) continue;
      if (!allowedRoles.has(chunk.roleScope as RoleScope)) continue;
      if (chunk.sourceType === "internal" && args.roleScope !== "super_admin") continue;
      if (args.locale && chunk.locale !== "mixed" && chunk.locale !== args.locale) continue;
      if (args.category && chunk.category !== args.category) continue;
      chunks.push({
        chunkId: chunk._id,
        documentId: chunk.documentId,
        title: chunk.title,
        category: chunk.category,
        roleScope: chunk.roleScope,
        locale: chunk.locale,
        sourceLabel: chunk.sourceLabel,
        text: chunk.chunkText.slice(0, 1800),
        score: result.score,
      });
      if (chunks.length >= args.limit) break;
    }
    return chunks;
  },
});

export const replaceDocumentChunks = internalMutation({
  args: {
    documentId: v.id("supportKnowledgeDocuments"),
    chunks: v.array(v.object({
      chunkIndex: v.number(),
      title: v.string(),
      chunkText: v.string(),
      embedding: v.array(v.float64()),
    })),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) throw new Error("Knowledge document not found");
    const existing = await ctx.db
      .query("supportKnowledgeChunks")
      .withIndex("by_documentId", (q: any) => q.eq("documentId", args.documentId))
      .take(500);
    for (const chunk of existing) {
      await ctx.db.delete(chunk._id);
    }
    const now = Date.now();
    for (const chunk of args.chunks) {
      await ctx.db.insert("supportKnowledgeChunks", {
        documentId: args.documentId,
        chunkIndex: chunk.chunkIndex,
        title: chunk.title.slice(0, 180),
        category: document.category,
        roleScope: document.roleScope,
        locale: document.locale,
        sourceType: document.sourceType,
        chunkText: chunk.chunkText.slice(0, 5000),
        embedding: chunk.embedding,
        sourceLabel: document.sourceLabel || document.title,
        isActive: document.isActive,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch(args.documentId, {
      contentHash: hashText(args.chunks.map((chunk) => chunk.chunkText).join("\n\n")),
      updatedAt: now,
    });
    return { ok: true, chunkCount: args.chunks.length };
  },
});

export const updateChunkEmbedding = internalMutation({
  args: {
    chunkId: v.id("supportKnowledgeChunks"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    if (args.embedding.length !== EMBEDDING_DIMENSIONS) throw new Error("Invalid embedding dimensions");
    await ctx.db.patch(args.chunkId, { embedding: args.embedding, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const insertKnowledgeAuditLog = internalMutation({
  args: {
    requestId: v.string(),
    userId: v.optional(v.id("users")),
    conversationId: v.optional(v.id("supportConversations")),
    actionType: v.string(),
    actionStatus: v.union(
      v.literal("executed"),
      v.literal("denied"),
      v.literal("failed"),
      v.literal("rate_limited"),
    ),
    reasonCategory: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("supportAgentAuditLogs", {
      requestId: args.requestId.slice(0, 80),
      userId: args.userId,
      conversationId: args.conversationId,
      actionType: args.actionType.slice(0, 80),
      actionStatus: args.actionStatus,
      reasonCategory: args.reasonCategory?.slice(0, 120),
      timestamp: Date.now(),
    });
    return { ok: true };
  },
});
