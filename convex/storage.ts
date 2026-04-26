import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// FILE STORAGE
// ============================================

// Generate upload URL
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Get file URL by storage ID
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Get multiple file URLs
export const getFileUrls = query({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    const urls = await Promise.all(
      args.storageIds.map(async (id) => ({
        storageId: id,
        url: await ctx.storage.getUrl(id),
      }))
    );
    return urls;
  },
});

// Delete file
export const deleteFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId);
    return true;
  },
});

// Get file metadata
export const getFileMetadata = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const metadata = await ctx.db.system.get(args.storageId);
    return metadata;
  },
});
