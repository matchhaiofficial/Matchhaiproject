import { hashPassword } from "better-auth/crypto";
import { v } from "convex/values";

import { components } from "./_generated/api";
import { mutation } from "./_generated/server";
import { getRuntimeEnv } from "./runtimeEnv";
import { SUPER_ADMIN_PRIMARY_EMAIL } from "./superAdminAccess";

const ENABLED_ENV = "MATCHHAI_ADMIN_PASSWORD_RECOVERY_ENABLED";
const TARGET_ENV = "MATCHHAI_ADMIN_PASSWORD_RECOVERY_TARGET";
const TOKEN_ENV = "MATCHHAI_ADMIN_PASSWORD_RECOVERY_TOKEN";
const REQUIRED_CONFIRMATION = "RESTORE_PRIMARY_SUPER_ADMIN_PASSWORD";

export const restorePrimaryFromBootstrapPassword = mutation({
  args: {
    confirm: v.string(),
    recoveryToken: v.string(),
    target: v.union(v.literal("dev"), v.literal("prod")),
  },
  handler: async (ctx, args) => {
    if (getRuntimeEnv(ENABLED_ENV) !== "1") {
      throw new Error(`${ENABLED_ENV} must be set to "1" before restoring the password.`);
    }
    if (getRuntimeEnv(TARGET_ENV) !== args.target) {
      throw new Error(`${TARGET_ENV} must match the requested target exactly.`);
    }
    if (getRuntimeEnv(TOKEN_ENV) !== args.recoveryToken) {
      throw new Error("The password recovery token is invalid for this deployment.");
    }
    if (args.confirm !== REQUIRED_CONFIRMATION) {
      throw new Error(`Pass confirm: "${REQUIRED_CONFIRMATION}" to restore the password.`);
    }

    const password = String(process.env.SUPER_ADMIN_BOOTSTRAP_TEMP_PASSWORD || "");
    if (!password) {
      throw new Error("SUPER_ADMIN_BOOTSTRAP_TEMP_PASSWORD is not configured for this deployment.");
    }
    if (!SUPER_ADMIN_PRIMARY_EMAIL) {
      throw new Error("The primary Super Admin email is not configured for this deployment.");
    }

    const profile = await ctx.db
      .query("users")
      .withIndex("by_email", (query) => query.eq("email", SUPER_ADMIN_PRIMARY_EMAIL))
      .unique();
    if (!profile?.authId || profile.role !== "super_admin") {
      throw new Error("The primary Super Admin account is missing or is not correctly configured.");
    }

    const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account",
      where: [
        { field: "userId", operator: "eq", value: profile.authId },
        { connector: "AND", field: "providerId", operator: "eq", value: "credential" },
      ],
    });
    const accountId = String((account as any)?.id || (account as any)?._id || "");
    if (!accountId) {
      throw new Error("The primary Super Admin credential account is missing.");
    }

    const now = Date.now();
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "account",
        where: [{ field: "_id", operator: "eq", value: accountId }],
        update: { password: await hashPassword(password), updatedAt: now },
      },
    });
    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: "session",
        where: [{ field: "userId", operator: "eq", value: profile.authId }],
      },
      paginationOpts: { cursor: null, numItems: 100 },
    });
    await ctx.db.patch(profile._id, { passwordChangedAt: now, updatedAt: now });

    return { ok: true, email: profile.email };
  },
});
