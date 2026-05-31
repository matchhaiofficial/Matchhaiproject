// Single source of truth for Super Admin access resolution.
//
// Every server-side gate imports from here so they authorize IDENTICALLY:
//   - convex/admin.ts          (session-token admin dashboard queries/mutations)
//   - convex/authz.ts          (ctx.auth identity-based requireSuperAdmin paths)
//   - convex/supportKnowledge.ts (support-knowledge admin gate)
//
// Before centralization each gate read a different env-var subset, so an admin
// could pass one gate and be denied by another. This module removes that drift.
//
// SECURITY: the backend remains the authoritative boundary. The client
// (src/utils/accountRouting.ts) only uses role/email as routing hints and must
// never be the sole gate. There is NO hardcoded email/id default — empty env
// means no implicit access (fail closed, CR-03).

export const SUPER_ADMIN_ROLE = "super_admin";
export const LEGACY_SUPER_ADMIN_ROLE = "super-admin";

// Canonical "first admin" email used only by the bootstrap mutation. Prefer the
// SERVER-ONLY var so the super-admin identity is not shipped in the client
// bundle; fall back to the legacy EXPO_PUBLIC_ var for backwards compatibility.
export const SUPER_ADMIN_PRIMARY_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL ||
  process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL ||
  ""
).trim().toLowerCase();

export type SuperAdminAllowlistEntry = {
  displayName: string;
  email: string;
  role: "super_admin";
  permissions?: string[];
  isActive: boolean;
};

export type SuperAdminAccessSource = "db_role" | "env_allowlist" | "both";

const SUPER_ADMIN_ALLOWLIST_NAMES = ["Junaid", "Ehteshan", "Zeerak", "Mubeen", "Saad", "Ovais"] as const;
const SUPER_ADMIN_ALLOWLIST_ENV_KEYS: Record<(typeof SUPER_ADMIN_ALLOWLIST_NAMES)[number], string> = {
  Junaid: "SUPER_ADMIN_EMAIL_JUNAID",
  Ehteshan: "SUPER_ADMIN_EMAIL_EHTESHAN",
  Zeerak: "SUPER_ADMIN_EMAIL_ZEERAK",
  Mubeen: "SUPER_ADMIN_EMAIL_MUBEEN",
  Saad: "SUPER_ADMIN_EMAIL_SAAD",
  Ovais: "SUPER_ADMIN_EMAIL_OVAIS",
};

export function normalizeSuperAdminEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase();
}

// Canonical "super_admin" plus legacy "super-admin" are BOTH accepted on read so
// existing/seed admins are never locked out (CR-05). New writes use the
// canonical form only — see admin.grantSuperAdmin.
export function isSuperAdminRole(role?: string | null) {
  const value = String(role || "").trim();
  return value === SUPER_ADMIN_ROLE || value === LEGACY_SUPER_ADMIN_ROLE;
}

export function isLegacySuperAdminRole(role?: string | null) {
  return String(role || "").trim() === LEGACY_SUPER_ADMIN_ROLE;
}

function parseSuperAdminAllowlistJson(): SuperAdminAllowlistEntry[] {
  const raw = String(process.env.SUPER_ADMIN_ALLOWLIST_JSON || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: any) => ({
        displayName: String(entry?.displayName || "").trim(),
        email: normalizeSuperAdminEmail(entry?.email || ""),
        role: "super_admin" as const,
        permissions: Array.isArray(entry?.permissions) ? entry.permissions.map(String) : undefined,
        isActive: entry?.isActive !== false,
      }))
      .filter((entry) => entry.displayName && entry.email);
  } catch {
    return [];
  }
}

// The canonical Super Admin email allowlist. This is the UNION (superset) of
// every variable any server gate historically read, so unifying the gates can
// never REMOVE an access path from a currently-working admin:
//   - named server slots SUPER_ADMIN_EMAIL_<NAME>
//   - SUPER_ADMIN_ALLOWLIST_JSON
//   - primary SUPER_ADMIN_EMAIL / EXPO_PUBLIC_SUPER_ADMIN_EMAIL
//   - EXPO_PUBLIC_SUPER_ADMIN_EMAILS (comma-separated)
// DB role is still the preferred mechanism for partner onboarding (no rebuild,
// satisfies the client guard too); the allowlist is the legacy/fallback path.
export function getSuperAdminAllowlist(): SuperAdminAllowlistEntry[] {
  const entries: SuperAdminAllowlistEntry[] = [];

  for (const displayName of SUPER_ADMIN_ALLOWLIST_NAMES) {
    const email = normalizeSuperAdminEmail(process.env[SUPER_ADMIN_ALLOWLIST_ENV_KEYS[displayName]] || "");
    if (email) entries.push({ displayName, email, role: "super_admin", isActive: true });
  }

  entries.push(...parseSuperAdminAllowlistJson());

  if (SUPER_ADMIN_PRIMARY_EMAIL) {
    entries.push({ displayName: "MatchHai Super Admin", email: SUPER_ADMIN_PRIMARY_EMAIL, role: "super_admin", isActive: true });
  }

  for (const raw of String(process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAILS || "").split(",")) {
    const email = normalizeSuperAdminEmail(raw);
    if (email) entries.push({ displayName: "Super Admin (allowlist)", email, role: "super_admin", isActive: true });
  }

  const byEmail = new Map<string, SuperAdminAllowlistEntry>();
  for (const entry of entries) {
    if (!byEmail.has(entry.email)) byEmail.set(entry.email, entry);
  }
  return Array.from(byEmail.values());
}

export function findSuperAdminAllowlistEntry(email?: string | null) {
  const normalized = normalizeSuperAdminEmail(email);
  if (!normalized) return null;
  return getSuperAdminAllowlist().find((entry) => entry.email === normalized && entry.isActive) || null;
}

export function isSuperAdminAllowlistedEmail(email?: string | null) {
  return Boolean(findSuperAdminAllowlistEntry(email));
}

// Authoritative server check: active DB role OR active env-allowlist email.
export function isAuthorizedSuperAdmin(profile: any, email?: string | null) {
  return isSuperAdminRole(profile?.role) || isSuperAdminAllowlistedEmail(email || profile?.email);
}

// Diagnostic helper for the access-overview query. Returns null when neither
// signal grants access.
export function resolveSuperAdminAccessSource(
  profile: any,
  email?: string | null,
): SuperAdminAccessSource | null {
  const byRole = isSuperAdminRole(profile?.role);
  const byEnv = isSuperAdminAllowlistedEmail(email || profile?.email);
  if (byRole && byEnv) return "both";
  if (byRole) return "db_role";
  if (byEnv) return "env_allowlist";
  return null;
}
