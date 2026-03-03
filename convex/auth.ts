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

// Create the Better Auth instance
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    trustedOrigins: [
      "matchhai://",
      "exp://",
      "http://localhost",
      "http://localhost:8081",
      "http://localhost:8082",
      "http://localhost:19000",
      "http://localhost:19006",
      "http://127.0.0.1:8081",
      "http://127.0.0.1:8082",
      "http://127.0.0.1:19000",
      "http://127.0.0.1:19006",
      // Common LAN IPs for Expo Go testing
      "http://192.168.1.1:8081",
      "http://192.168.0.1:8081",
      // Allow all origins in development (remove in production)
      "*",
    ],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      expo(),
      convex({ authConfig }),
      phoneNumber({
        // OTP sending - placeholder for now (user wants to skip OTP initially)
        sendOTP: async ({ phoneNumber: phone, code }, request) => {
          // TODO: Implement SMS sending when ready
          console.log(`[Auth] OTP for ${phone}: ${code}`);
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
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now,
    });

    return userId;
  },
});
