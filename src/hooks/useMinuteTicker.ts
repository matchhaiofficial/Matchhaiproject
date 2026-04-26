import { useSyncExternalStore } from "react";

const TICK_MS = 60 * 1000;

let nowMs = Date.now();
let intervalHandle: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

const publish = () => {
  nowMs = Date.now();
  listeners.forEach((listener) => listener());
};

const startInterval = () => {
  if (intervalHandle || listeners.size === 0) return;
  intervalHandle = setInterval(publish, TICK_MS);
};

const stopInterval = () => {
  if (!intervalHandle || listeners.size > 0) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  startInterval();

  return () => {
    listeners.delete(listener);
    stopInterval();
  };
};

const getSnapshot = () => nowMs;

export function useMinuteTicker() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
