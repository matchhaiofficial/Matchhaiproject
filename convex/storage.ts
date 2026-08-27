import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// FILE STORAGE
// ============================================

export function rejectDeprecatedStorageEndpoint(): never {
  throw new Error("Deprecated generic storage endpoint is disabled.");
}

// Retained as fail-closed compatibility stubs. Uploads and reads must use a
// resource-specific function that verifies the caller's access to that resource.
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async () => rejectDeprecatedStorageEndpoint(),
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async () => rejectDeprecatedStorageEndpoint(),
});

export const getFileUrls = query({
  args: { storageIds: v.array(v.id("_storage")) },
  returns: v.array(v.object({
    storageId: v.id("_storage"),
    url: v.union(v.string(), v.null()),
  })),
  handler: async () => rejectDeprecatedStorageEndpoint(),
});

export const deleteFile = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.boolean(),
  handler: async () => rejectDeprecatedStorageEndpoint(),
});

export const getFileMetadata = query({
  args: { storageId: v.id("_storage") },
  returns: v.any(),
  handler: async () => rejectDeprecatedStorageEndpoint(),
});
