/// <reference types="vite/client" />

// Function modules for convex-test. Files with more than one extension (such
// as this setup file) are intentionally excluded from Convex registration.
export const modules = import.meta.glob("./**/!(*.*.*)*.*s");
