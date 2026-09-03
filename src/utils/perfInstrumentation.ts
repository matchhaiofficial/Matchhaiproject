import AsyncStorage from "@react-native-async-storage/async-storage";

import Logger from "./logger";

type PerfEventType = "span_start" | "span_end" | "mark" | "metric" | "warning" | "error";
type PerfMeta = Record<string, unknown> | undefined;
type LoadingDeps = Record<string, boolean>;

export type PerfEventV1 = {
  v: 1;
  ts: number;
  type: PerfEventType;
  name: string;
  cid?: string;
  sid?: string;
  routeKey?: string;
  actionKey?: string;
  durationMs?: number;
  ok?: boolean;
  error?: { message: string; code?: string };
  meta?: Record<string, unknown>;
};

type SpanRecord = {
  id: string;
  name: string;
  ts: number;
  cid?: string;
  routeKey?: string;
  actionKey?: string;
  meta?: Record<string, unknown>;
};

type NavMark = {
  cid: string;
  startedAt: number;
  routeKey: string;
  meta?: Record<string, unknown>;
};

type LoadingSession = {
  sid: string;
  startedAt: number;
  lastChangeAt: number;
  timeoutAt: number;
  warned: boolean;
  routeKey?: string;
  cid?: string;
  meta?: Record<string, unknown>;
};

const STORAGE_KEY = "perf_debug_events_v1";
const MAX_EVENTS = 500;
const MAX_EVENT_BYTES = 4096;
const MAX_PERSIST_BYTES = 150_000;
const PERSIST_DEBOUNCE_MS = 2000;
const PERSIST_BATCH_SIZE = 25;
const REDACT_KEYS = ["email", "phone", "contactEmail", "contactPhone", "password"];

const spans = new Map<string, SpanRecord>();
const pendingNavMarks = new Map<string, NavMark[]>();
const loadingSessions = new Map<string, LoadingSession>();
const cidStack: string[] = [];
let eventBuffer: PerfEventV1[] = [];
let hasLoadedPersistedEvents = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPersistEvents = 0;

function isPerfEnabled() {
  return __DEV__;
}

function randomId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function sanitizeValue(value: unknown, key?: string): unknown {
  if (value == null) return value;

  if (key && REDACT_KEYS.includes(key)) {
    return "[redacted]";
  }

  if (typeof value === "function") return "[function]";
  if (typeof value === "string") {
    return value.length > 256 ? `${value.slice(0, 256)}...[truncated]` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(record).slice(0, 30)) {
      next[entryKey] = sanitizeValue(entryValue, entryKey);
    }
    return next;
  }

  return String(value);
}

function sanitizeMeta(meta?: PerfMeta) {
  if (!meta) return undefined;
  const sanitized = sanitizeValue(meta) as Record<string, unknown>;
  const json = safeStringify(sanitized);
  if (!json || json.length <= MAX_EVENT_BYTES / 2) {
    return sanitized;
  }

  const cappedEntries = Object.entries(sanitized).slice(0, 12);
  return Object.fromEntries(cappedEntries.map(([key, value]) => [key, sanitizeValue(value, key)]));
}

function capEvent(event: PerfEventV1) {
  const withSanitizedMeta: PerfEventV1 = {
    ...event,
    meta: sanitizeMeta(event.meta),
  };

  const json = safeStringify(withSanitizedMeta);
  if (!json || json.length <= MAX_EVENT_BYTES) {
    return withSanitizedMeta;
  }

  return {
    ...withSanitizedMeta,
    meta: {
      truncated: true,
      originalBytes: json?.length ?? null,
    },
  };
}

function schedulePersist() {
  if (!isPerfEnabled()) return;
  pendingPersistEvents += 1;
  if (persistTimer || pendingPersistEvents < PERSIST_BATCH_SIZE) {
    if (!persistTimer) {
      persistTimer = setTimeout(() => {
        persistTimer = null;
        pendingPersistEvents = 0;
        void persistEvents();
      }, PERSIST_DEBOUNCE_MS);
    }
    return;
  }

  pendingPersistEvents = 0;
  void persistEvents();
}

async function persistEvents() {
  if (!isPerfEnabled()) return;
  const persisted: PerfEventV1[] = [];
  let bytes = 2;

  for (let index = eventBuffer.length - 1; index >= 0; index -= 1) {
    const event = eventBuffer[index];
    const json = safeStringify(event);
    if (!json) continue;

    const nextBytes = bytes + json.length + (persisted.length ? 1 : 0);
    if (nextBytes > MAX_PERSIST_BYTES) break;

    persisted.unshift(event);
    bytes = nextBytes;
  }

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch (error) {
    Logger.warn("Perf", "Failed to persist perf events", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function loadPersistedEvents() {
  if (!isPerfEnabled() || hasLoadedPersistedEvents) return;
  hasLoadedPersistedEvents = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PerfEventV1[];
    eventBuffer = Array.isArray(parsed) ? parsed.slice(-MAX_EVENTS) : [];
  } catch (error) {
    Logger.warn("Perf", "Failed to load persisted perf events", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function emit(event: PerfEventV1) {
  if (!isPerfEnabled()) return event;

  const capped = capEvent(event);
  eventBuffer.push(capped);
  if (eventBuffer.length > MAX_EVENTS) {
    eventBuffer = eventBuffer.slice(-MAX_EVENTS);
  }

  Logger.info("Perf", capped.name, capped);
  schedulePersist();
  return capped;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: String(error) };
}

function currentCid() {
  return cidStack.length > 0 ? cidStack[cidStack.length - 1] : undefined;
}

function pushCid(cid: string) {
  cidStack.push(cid);
}

function popCid(cid: string) {
  const index = cidStack.lastIndexOf(cid);
  if (index >= 0) {
    cidStack.splice(index, 1);
  }
}

function spanStart(name: string, options?: { cid?: string; routeKey?: string; actionKey?: string; meta?: PerfMeta }) {
  const spanId = randomId("sid");
  const ts = Date.now();
  const cid = options?.cid ?? currentCid();
  const record: SpanRecord = {
    id: spanId,
    name,
    ts,
    cid,
    routeKey: options?.routeKey,
    actionKey: options?.actionKey,
    meta: sanitizeMeta(options?.meta),
  };
  spans.set(spanId, record);

  emit({
    v: 1,
    ts,
    type: "span_start",
    name,
    sid: spanId,
    cid,
    routeKey: options?.routeKey,
    actionKey: options?.actionKey,
    meta: record.meta,
  });

  return spanId;
}

function spanEnd(
  spanId: string,
  options?: { ok?: boolean; routeKey?: string; meta?: PerfMeta; error?: { message: string; code?: string } },
) {
  const record = spans.get(spanId);
  if (!record) return;
  spans.delete(spanId);

  emit({
    v: 1,
    ts: Date.now(),
    type: options?.error ? "error" : "span_end",
    name: record.name,
    sid: spanId,
    cid: record.cid,
    routeKey: options?.routeKey ?? record.routeKey,
    actionKey: record.actionKey,
    durationMs: Date.now() - record.ts,
    ok: options?.ok,
    error: options?.error,
    meta: {
      ...(record.meta || {}),
      ...(sanitizeMeta(options?.meta) || {}),
    },
  });
}

async function measureAsync<T>(
  name: string,
  fn: () => Promise<T> | T,
  options?: { cid?: string; routeKey?: string; actionKey?: string; meta?: PerfMeta },
) {
  if (!isPerfEnabled()) {
    return await Promise.resolve(fn());
  }

  const spanId = spanStart(name, options);
  try {
    const result = await Promise.resolve(fn());
    spanEnd(spanId, { ok: true });
    return result;
  } catch (error) {
    spanEnd(spanId, { ok: false, error: normalizeError(error) });
    throw error;
  }
}

function mark(name: string, options?: { cid?: string; routeKey?: string; actionKey?: string; meta?: PerfMeta }) {
  emit({
    v: 1,
    ts: Date.now(),
    type: "mark",
    name,
    cid: options?.cid ?? currentCid(),
    routeKey: options?.routeKey,
    actionKey: options?.actionKey,
    meta: sanitizeMeta(options?.meta),
  });
}

function metric(name: string, meta?: PerfMeta) {
  emit({
    v: 1,
    ts: Date.now(),
    type: "metric",
    name,
    cid: currentCid(),
    meta: sanitizeMeta(meta),
  });
}

function warning(name: string, meta?: PerfMeta) {
  emit({
    v: 1,
    ts: Date.now(),
    type: "warning",
    name,
    cid: currentCid(),
    meta: sanitizeMeta(meta),
  });
}

function error(name: string, payload: { error: unknown; cid?: string; routeKey?: string; meta?: PerfMeta }) {
  emit({
    v: 1,
    ts: Date.now(),
    type: "error",
    name,
    cid: payload.cid ?? currentCid(),
    routeKey: payload.routeKey,
    error: normalizeError(payload.error),
    meta: sanitizeMeta(payload.meta),
  });
}

function markNav(options: { routeKey: string; cid?: string; meta?: PerfMeta }) {
  const routeKey = options.routeKey;
  const entry: NavMark = {
    cid: options.cid ?? currentCid() ?? randomId("cid"),
    startedAt: Date.now(),
    routeKey,
    meta: sanitizeMeta(options.meta),
  };
  const existing = pendingNavMarks.get(routeKey) || [];
  existing.push(entry);
  pendingNavMarks.set(routeKey, existing.slice(-5));

  mark("Nav.Mark", {
    cid: entry.cid,
    routeKey,
    meta: entry.meta,
  });

  return entry.cid;
}

function consumeNavMark(routeKey?: string | null) {
  if (!routeKey) return null;
  const existing = pendingNavMarks.get(routeKey);
  if (!existing || existing.length === 0) return null;
  const entry = existing.shift() || null;
  if (!existing.length) {
    pendingNavMarks.delete(routeKey);
  } else {
    pendingNavMarks.set(routeKey, existing);
  }
  return entry;
}

function beginLoading(
  key: string,
  name: string,
  deps: LoadingDeps,
  options?: { routeKey?: string; cid?: string; timeoutMs?: number; meta?: PerfMeta },
) {
  if (!isPerfEnabled()) return;
  if (loadingSessions.has(key)) return;
  const sid = spanStart(name, {
    cid: options?.cid,
    routeKey: options?.routeKey,
    meta: {
      ...sanitizeMeta(options?.meta),
      deps,
    },
  });

  loadingSessions.set(key, {
    sid,
    startedAt: Date.now(),
    lastChangeAt: Date.now(),
    timeoutAt: Date.now() + (options?.timeoutMs ?? 8000),
    warned: false,
    routeKey: options?.routeKey,
    cid: options?.cid ?? currentCid(),
    meta: sanitizeMeta(options?.meta),
  });
}

function updateLoading(key: string, deps: LoadingDeps) {
  const session = loadingSessions.get(key);
  if (!session) return;
  session.lastChangeAt = Date.now();

  if (!session.warned && Date.now() >= session.timeoutAt) {
    session.warned = true;
    warning("Load.Stuck", {
      routeKey: session.routeKey,
      cid: session.cid,
      key,
      durationMs: Date.now() - session.startedAt,
      deps,
      lastChangeAt: session.lastChangeAt,
      ...(session.meta || {}),
    });
  }
}

function endLoading(key: string, deps: LoadingDeps) {
  const session = loadingSessions.get(key);
  if (!session) return;
  loadingSessions.delete(key);
  spanEnd(session.sid, {
    ok: true,
    routeKey: session.routeKey,
    meta: {
      deps,
      ...(session.meta || {}),
    },
  });
}

export const PerfScope = {
  run<T>(cid: string, fn: () => Promise<T> | T) {
    pushCid(cid);
    try {
      const result = fn();
      if (result && typeof (result as Promise<T>).then === "function") {
        return Promise.resolve(result).finally(() => {
          popCid(cid);
        });
      }
      popCid(cid);
      return result;
    } catch (scopeError) {
      popCid(cid);
      throw scopeError;
    }
  },
};

export const Perf = {
  async ensureLoaded() {
    await loadPersistedEvents();
  },
  newCid() {
    return randomId("cid");
  },
  currentCid,
  startSpan: spanStart,
  endSpan: spanEnd,
  measureAsync,
  mark,
  metric,
  warning,
  error,
  markNav,
  consumeNavMark,
  beginLoading,
  updateLoading,
  endLoading,
  getEvents() {
    return [...eventBuffer];
  },
  async clear() {
    eventBuffer = [];
    spans.clear();
    pendingNavMarks.clear();
    loadingSessions.clear();
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    pendingPersistEvents = 0;
    if (isPerfEnabled()) {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  },
  exportJson() {
    return JSON.stringify(eventBuffer, null, 2);
  },
};

export function recordPayloadMetric(metricName: string, payload: unknown, meta?: PerfMeta) {
  Perf.metric(metricName, {
    bytes: safeStringify(payload)?.length ?? 0,
    items: Array.isArray(payload)
      ? payload.length
      : payload && typeof payload === "object"
        ? Object.keys(payload as Record<string, unknown>).length
        : payload == null
          ? 0
          : 1,
    ...(meta || {}),
  });
}

export function recordCountMetric(metricName: string, count: number, meta?: PerfMeta) {
  Perf.metric(metricName, {
    count,
    ...(meta || {}),
  });
}

const rateWindows = new Map<string, { windowStartMs: number; polls: number; units: number }>();

export function recordRateMetric(metricName: string, units: number, meta?: PerfMeta) {
  const now = Date.now();
  const existing = rateWindows.get(metricName);
  const current =
    !existing || now - existing.windowStartMs >= 60_000
      ? { windowStartMs: now, polls: 0, units: 0 }
      : existing;

  current.polls += 1;
  current.units += units;
  rateWindows.set(metricName, current);

  if (now - current.windowStartMs < 60_000) {
    return;
  }

  Perf.metric(metricName, {
    windowMs: now - current.windowStartMs,
    polls: current.polls,
    units: current.units,
    ...(meta || {}),
  });

  rateWindows.set(metricName, {
    windowStartMs: now,
    polls: 0,
    units: 0,
  });
}
