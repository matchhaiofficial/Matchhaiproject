import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { phoneNumber } from "better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import authConfig from "./auth.config";

// Create the Better Auth component client
export const authComponent = createClient<DataModel>(components.betterAuth);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "MatchHai <no-reply@matchhai.com>";
const DEFAULT_SITE_URL = process.env.EXPO_PUBLIC_CONVEX_SITE_URL || process.env.APP_BASE_URL || "";
const TRUSTED_ORIGINS = [
  "matchhai://",
  "exp://",
  DEFAULT_SITE_URL,
  process.env.APP_BASE_URL,
  process.env.EXPO_PUBLIC_APP_WEB_URL,
  "http://localhost",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:19000",
  "http://localhost:19006",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:8082",
  "http://127.0.0.1:19000",
  "http://127.0.0.1:19006",
].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);

async function sendResendEmail(input: { to: string; subject: string; text: string; html?: string }) {
  if (!RESEND_API_KEY) {
    console.warn("[auth] RESEND_API_KEY is not configured; skipping email send");
    return;
  }

  const trimmedFrom = String(RESEND_FROM_EMAIL || "").trim();
  const fromLooksValid = /^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(trimmedFrom)
    || /^[^<>]+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/.test(trimmedFrom);

  if (!fromLooksValid) {
    throw new Error(
      "Email delivery is misconfigured: RESEND_FROM_EMAIL must look like no-reply@example.com or MatchHai <no-reply@example.com>."
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[auth] Resend email send failed", {
      to: input.to,
      subject: input.subject,
      status: response.status,
      body,
    });
    if (response.status === 422 && body.includes("Invalid `from` field")) {
      throw new Error(
        "Email delivery is misconfigured: RESEND_FROM_EMAIL must look like no-reply@example.com or MatchHai <no-reply@example.com>."
      );
    }
    if (response.status === 403 && body.includes("domain is not verified")) {
      throw new Error(
        "Email delivery is blocked: matchhai.com is not verified in Resend yet. Verify the domain in Resend before sending emails to users."
      );
    }
    if (
      response.status === 403
      && body.includes("only send testing emails to your own email address")
    ) {
      throw new Error(
        "Email delivery is blocked: this Resend account is still in testing mode and can only send to the account owner's email address until a domain is verified."
      );
    }
    throw new Error(`Failed to send email: ${response.status} ${body}`);
  }
}

// Create the Better Auth instance
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    trustedOrigins: TRUSTED_ORIGINS,
    database: authComponent.adapter(ctx),
    emailVerification: {
      sendOnSignUp: false,
      sendOnSignIn: false,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendResendEmail({
          to: user.email,
          subject: "Verify your MatchHai email",
          text: `Verify your email address: ${url}`,
          html: `<p>Verify your MatchHai email address by clicking the link below:</p><p><a href="${url}">${url}</a></p>`,
        });
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        await sendResendEmail({
          to: user.email,
          subject: "Reset your MatchHai password",
          text: `Reset your password using this link: ${url}`,
          html: `<p>Reset your MatchHai password using the link below:</p><p><a href="${url}">${url}</a></p>`,
        });
      },
    },
    plugins: [
      expo(),
      convex({ authConfig }),
      phoneNumber({
        requireVerification: true,
        // OTP sending - placeholder for now (user wants to skip OTP initially)
        sendOTP: async () => {
          console.warn("[Auth] Better Auth phone OTP sending is not configured; use VeevoTech OTP flow.");
        },
        // When verification happens, create user with phone as identifier
        signUpOnVerification: {
          getTempEmail: (phone: string) => {
            // Generate a temp email from phone number for Better Auth compatibility
            const cleanPhone = phone.replace(/\D/g, "");
            return `${cleanPhone}@matchhai.phone`;
          },
          getTempName: (phone: string) => phone,
        },
      }),
    ],
  });
};

// Query to get the current authenticated user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});

// Query to get user by auth ID (links auth to our users table)
export const getUserByAuthId = query({
  args: { authId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();
  },
});

// Mutation to link auth user to our users table after signup
export const linkAuthToUser = mutation({
  args: {
    authId: v.string(),
    email: v.string(),
    fullName: v.string(),
    username: v.string(),
    phone: v.optional(v.string()),
    accountType: v.union(v.literal("player"), v.literal("zone")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();

    if (existingUser) {
      return existingUser._id;
    }

    // Create new user record
    const userId = await ctx.db.insert("users", {
      authId: args.authId,
      email: args.email.toLowerCase(),
      fullName: args.fullName,
      username: args.username,
      usernameLower: args.username.toLowerCase(),
      phone: args.phone,
      accountType: args.accountType,
      isOnline: true,
      lastActiveAt: now,
      onboardingCompleted: false,
      kycVerificationStatus: "not_started",
      createdAt: now,
      updatedAt: now,
    });

    return userId;
  },
});
