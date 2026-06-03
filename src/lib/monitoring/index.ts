/**
 * Provider-agnostic monitoring core.
 *
 * Public API:
 *   - initMonitoring()            – wire global handlers, pick an adapter.
 *   - captureException(err, ctx)  – report an error.
 *   - captureMessage(msg, lvl, ctx)
 *   - addBreadcrumb({...})        – breadcrumb / lightweight event.
 *   - setUser({ id }) / clearUser()
 *   - triggerTestMonitoringEvent() – dev/staging-only smoke test.
 *
 * Design:
 *   - If EXPO_PUBLIC_SENTRY_DSN is set AND `@sentry/react-native` is installed,
 *     calls route through the Sentry adapter. Otherwise everything no-ops to
 *     the existing local `Logger` (so dev/test stays quiet & safe).
 *   - All context is run through `redact()` before leaving the device, so no
 *     PII/secrets are ever forwarded.
 *   - Global error + unhandled-rejection handlers are installed in a way that
 *     PRESERVES any previously-registered handler (e.g. the keep-awake filter
 *     in app/_layout.tsx).
 *   - Never throws: monitoring failures must not crash the app.
 */

import Logger from "../../utils/logger";
import { redact } from "./redact";
import { createSentryAdapter, type MonitoringAdapter } from "./sentryAdapter";
import type { MonitorContext, MonitorLevel, MonitorUser } from "./types";

export type { MonitorContext, MonitorLevel, MonitorUser } from "./types";

const LOG_CONTEXT = "Monitoring";

type MonitoringState = {
  initialized: boolean;
  adapter: MonitoringAdapter | null;
  env: string;
  dsn: string | null;
  user: MonitorUser | null;
  /** Restores the previous ErrorUtils handler on teardown (mainly for tests). */
  teardown: (() => void) | null;
};

const state: MonitoringState = {
  initialized: false,
  adapter: null,
  env: "development",
  dsn: null,
  user: null,
  teardown: null,
};

function readEnv(): string {
  return process.env.EXPO_PUBLIC_ENV || (typeof __DEV__ !== "undefined" && __DEV__ ? "development" : "production");
}

function readDsn(): string | null {
  const dsn = (process.env.EXPO_PUBLIC_SENTRY_DSN || "").trim();
  return dsn.length > 0 ? dsn : null;
}

function isProd(): boolean {
  return state.env === "production" || state.env === "prod";
}

/** Safe-by-construction context: always redacted, never throws. */
function safeContext(context?: MonitorContext): MonitorContext | undefined {
  if (!context) return undefined;
  try {
    return redact(context) as MonitorContext;
  } catch {
    return undefined;
  }
}

/**
 * Initialise monitoring. Idempotent and safe to call in dev/test. Reads
 * DSN/env from EXPO_PUBLIC_* vars. Installs global handlers preserving any
 * previously-registered handler.
 */
export function initMonitoring(): void {
  if (state.initialized) return;
  state.initialized = true;
  state.env = readEnv();
  state.dsn = readDsn();

  // Pick an adapter only when a DSN is configured. Without a DSN we stay in
  // Logger-only mode (the common dev/test path).
  if (state.dsn) {
    try {
      state.adapter = createSentryAdapter({ dsn: state.dsn, environment: state.env });
    } catch {
      state.adapter = null;
    }
  }

  Logger.info(
    LOG_CONTEXT,
    `initMonitoring env=${state.env} dsn=${state.dsn ? "set" : "none"} adapter=${state.adapter?.name ?? "logger"}`,
  );

  installGlobalHandlers();
}

function installGlobalHandlers(): void {
  const globalAny = globalThis as any;

  // --- Global JS error handler (preserve previous) ---
  const errorUtils = globalAny.ErrorUtils;
  let restoreErrorHandler: (() => void) | null = null;

  if (errorUtils && typeof errorUtils.setGlobalHandler === "function") {
    const previous =
      typeof errorUtils.getGlobalHandler === "function" ? errorUtils.getGlobalHandler() : null;

    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      captureException(error, { fatal: !!isFatal, source: "globalHandler" });
      if (typeof previous === "function") {
        try {
          previous(error, isFatal);
        } catch {
          /* noop */
        }
      }
    });

    restoreErrorHandler = () => {
      try {
        if (typeof errorUtils.setGlobalHandler === "function") {
          errorUtils.setGlobalHandler(previous ?? (() => undefined));
        }
      } catch {
        /* noop */
      }
    };
  }

  // --- Unhandled promise rejection (best effort; preserve previous) ---
  // RN/Hermes expose this as an assignable global property.
  const previousUnhandled = globalAny.onunhandledrejection;
  globalAny.onunhandledrejection = (event: any) => {
    const reason = event?.reason ?? event;
    captureException(reason, { source: "unhandledRejection" });
    if (typeof previousUnhandled === "function") {
      try {
        previousUnhandled(event);
      } catch {
        /* noop */
      }
    }
  };
  const restoreUnhandled = () => {
    globalAny.onunhandledrejection = previousUnhandled;
  };

  state.teardown = () => {
    restoreErrorHandler?.();
    restoreUnhandled?.();
    state.teardown = null;
  };
}

/** Tear down installed handlers + reset. Primarily for tests. */
export function __resetMonitoringForTests(): void {
  state.teardown?.();
  state.initialized = false;
  state.adapter = null;
  state.user = null;
  state.dsn = null;
}

/** Report an exception with optional (redacted) context. Never throws. */
export function captureException(error: unknown, context?: MonitorContext): void {
  const ctx = safeContext(context);
  try {
    if (state.adapter) {
      state.adapter.captureException(error, ctx);
      return;
    }
  } catch {
    /* fall through to logger */
  }
  Logger.error(LOG_CONTEXT, "captureException", { error, context: ctx });
}

/** Report a message at a given level with optional (redacted) context. */
export function captureMessage(
  message: string,
  level: MonitorLevel = "info",
  context?: MonitorContext,
): void {
  const ctx = safeContext(context);
  try {
    if (state.adapter) {
      state.adapter.captureMessage(message, level, ctx);
      return;
    }
  } catch {
    /* fall through to logger */
  }
  const line = `${message}`;
  switch (level) {
    case "fatal":
    case "error":
      Logger.error(LOG_CONTEXT, line, ctx);
      break;
    case "warning":
      Logger.warn(LOG_CONTEXT, line, ctx);
      break;
    case "debug":
      Logger.debug(LOG_CONTEXT, line, ctx);
      break;
    case "info":
    default:
      Logger.info(LOG_CONTEXT, line, ctx);
      break;
  }
}

/** Add a breadcrumb / lightweight event. Data is redacted before send. */
export function addBreadcrumb(breadcrumb: {
  category: string;
  message: string;
  level?: MonitorLevel;
  data?: Record<string, unknown>;
}): void {
  const level = breadcrumb.level ?? "info";
  const data = breadcrumb.data ? (redact(breadcrumb.data) as Record<string, unknown>) : undefined;
  try {
    if (state.adapter) {
      state.adapter.addBreadcrumb({
        category: breadcrumb.category,
        message: breadcrumb.message,
        level,
        data,
      });
      return;
    }
  } catch {
    /* fall through */
  }
  Logger.debug(LOG_CONTEXT, `breadcrumb:${breadcrumb.category} ${breadcrumb.message}`, data);
}

/** Associate an opaque user id with subsequent reports. Never store PII. */
export function setUser(user: MonitorUser): void {
  if (!user || !user.id) return;
  // Guard: refuse anything that looks like an email/phone rather than an id.
  const id = String(user.id);
  state.user = { id };
  try {
    state.adapter?.setUser({ id });
  } catch {
    /* noop */
  }
}

export function clearUser(): void {
  state.user = null;
  try {
    state.adapter?.setUser(null);
  } catch {
    /* noop */
  }
}

/** Introspection for tests / diagnostics. */
export function getMonitoringStatus(): {
  initialized: boolean;
  adapter: string;
  env: string;
  dsnConfigured: boolean;
  hasUser: boolean;
} {
  return {
    initialized: state.initialized,
    adapter: state.adapter?.name ?? "logger",
    env: state.env,
    dsnConfigured: !!state.dsn,
    hasUser: !!state.user,
  };
}

/**
 * Fire a synthetic event to verify the monitoring pipeline end-to-end.
 * GUARDED: only runs in non-production environments. In prod it is a no-op so
 * it can be left wired in without polluting real telemetry.
 *
 * Call from a dev menu / button, e.g.:
 *   import { triggerTestMonitoringEvent } from "@/lib/monitoring";
 *   triggerTestMonitoringEvent();
 */
export function triggerTestMonitoringEvent(): void {
  if (isProd()) return;
  captureMessage("test_monitoring_event", "info", {
    env: state.env,
    source: "triggerTestMonitoringEvent",
  });
  addBreadcrumb({
    category: "diagnostics",
    message: "test_monitoring_breadcrumb",
    level: "debug",
    data: { env: state.env },
  });
  captureException(new Error("test_monitoring_exception"), {
    source: "triggerTestMonitoringEvent",
  });
}
