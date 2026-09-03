import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { ConvexHttpClient } from "convex/browser";

function stripQuotes(value) {
  const trimmed = String(value || "").trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseDotEnv(contents) {
  const env = {};
  for (const rawLine of String(contents || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = stripQuotes(line.slice(idx + 1));
    if (!key) continue;
    env[key] = value;
  }
  return env;
}

async function loadEnvFiles() {
  const cwd = process.cwd();
  const paths = [path.join(cwd, ".env"), path.join(cwd, ".env.local")];
  for (const p of paths) {
    try {
      const contents = await fs.readFile(p, "utf8");
      const parsed = parseDotEnv(contents);
      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] == null || process.env[k] === "") process.env[k] = v;
      }
    } catch {
      // ignore missing/unreadable env files
    }
  }
}

await loadEnvFiles();

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
const ingestKey = process.env.SUPPORT_KNOWLEDGE_INGEST_KEY || process.argv[2];
const filePath = process.argv[3] || path.join(process.cwd(), "docs", "chatbot", "APP_KNOWLEDGE.md");

if (!CONVEX_URL) {
  console.error("Missing EXPO_PUBLIC_CONVEX_URL or CONVEX_URL.");
  process.exit(1);
}

if (!ingestKey) {
  console.error('Usage: node scripts/ingest-support-knowledge.mjs "<SUPPORT_KNOWLEDGE_INGEST_KEY>" [markdownPath]');
  process.exit(1);
}

const content = await fs.readFile(filePath, "utf8");
const client = new ConvexHttpClient(CONVEX_URL);

const result = await client.action("supportKnowledge:ingestDocumentWithKey", {
  ingestKey,
  title: "Matchhai App Knowledge Base",
  slug: "matchhai-app-knowledge-base",
  category: "app_knowledge",
  roleScope: "all",
  locale: "mixed",
  sourceType: "markdown",
  sourceLabel: "docs/chatbot/APP_KNOWLEDGE.md",
  content,
  chunkSize: 1800,
  overlap: 180,
});

console.log(JSON.stringify(result, null, 2));
