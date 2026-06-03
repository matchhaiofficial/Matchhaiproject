/**
 * Provider-agnostic Sentry adapter (STUB).
 *
 * This module exposes the same shape the monitoring core expects, but it does
 * NOT hard-depend on `@sentry/react-native`. The native SDK requires a config
 * plugin + native rebuild (EAS), which is intentionally out of scope here.
 *
 * Behaviour:
 *  - `createSentryAdapter()` lazily attempts `require('@sentry/react-native')`
 *    inside try/catch. If the package is not installed (the current state) it
 *    returns `null` and the monitoring core falls back to the local Logger.
 *  - If/when the package IS installed and a DSN is provided, this adapter
 *    initialises Sentry and forwards calls. See docs/MONITORING.md for the
 *    install + native-rebuild steps.
 *
 * Nothing in here imports Sentry at module load time, so the bundle stays
 * clean and the app never crashes when the SDK is absent.
 */

import type { MonitorContext, MonitorLevel, MonitorUser } from "./types";

export interface MonitoringAdapter {
  readonly name: string;
  captureException(error: unknown, context?: MonitorContext): void;
  captureMessage(message: string, level: MonitorLevel, context?: MonitorContext): void;
  addBreadcrumb(breadcrumb: {
    category: string;
    message: string;
    level: MonitorLevel;
    data?: Record<string, unknown>;
  }): void;
  setUser(user: MonitorUser | null): void;
}

type SentryConfig = {
  dsn: string;
  environment: string;
  /** 0..1 sample rate for traces; conservative default. */
  tracesSampleRate?: number;
};

/**
 * Attempt to construct a Sentry-backed adapter. Returns `null` when the SDK is
 * not installed or initialisation fails — callers MUST handle null.
 */
export function createSentryAdapter(config: SentryConfig): MonitoringAdapter | null {
  let Sentry: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    Sentry = require("@sentry/react-native");
  } catch {
    // Package not installed — opt-in. Caller falls back to Logger.
    return null;
  }

  if (!Sentry || typeof Sentry.init !== "function") {
    return null;
  }

  try {
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      tracesSampleRate: config.tracesSampleRate ?? 0.1,
      // We do our own redaction before anything reaches Sentry; disable
      // automatic PII collection as defence in depth.
      sendDefaultPii: false,
    });
  } catch {
    return null;
  }

  const toSentryLevel = (level: MonitorLevel): string => {
    switch (level) {
      case "fatal":
        return "fatal";
      case "error":
        return "error";
      case "warning":
        return "warning";
      case "debug":
        return "debug";
      case "info":
      default:
        return "info";
    }
  };

  return {
    name: "sentry",
    captureException(error, context) {
      try {
        Sentry.captureException(error, context ? { extra: context } : undefined);
      } catch {
        /* never throw from monitoring */
      }
    },
    captureMessage(message, level, context) {
      try {
        Sentry.captureMessage(message, {
          level: toSentryLevel(level),
          extra: context,
        });
      } catch {
        /* noop */
      }
    },
    addBreadcrumb(breadcrumb) {
      try {
        Sentry.addBreadcrumb({
          category: breadcrumb.category,
          message: breadcrumb.message,
          level: toSentryLevel(breadcrumb.level),
          data: breadcrumb.data,
        });
      } catch {
        /* noop */
      }
    },
    setUser(user) {
      try {
        Sentry.setUser(user ? { id: user.id } : null);
      } catch {
        /* noop */
      }
    },
  };
}
