import { useEffect, useMemo, useRef } from "react";

import { Perf } from "../utils/perfInstrumentation";

type LoadingDeps = Record<string, boolean>;

type Options = {
  routeKey?: string;
  cid?: string;
  timeoutMs?: number;
  meta?: Record<string, unknown>;
};

function serializeDeps(deps: LoadingDeps) {
  return JSON.stringify(Object.entries(deps).sort(([left], [right]) => left.localeCompare(right)));
}

export function usePerfLoadingDeps(name: string, deps: LoadingDeps, options?: Options) {
  const keyRef = useRef(`${name}:${options?.routeKey || "global"}`);
  const depsJson = useMemo(() => serializeDeps(deps), [deps]);
  const anyLoading = Object.values(deps).some(Boolean);

  useEffect(() => {
    const key = keyRef.current;
    if (anyLoading) {
      Perf.beginLoading(key, name, deps, options);
      Perf.updateLoading(key, deps);
      return;
    }

    Perf.endLoading(key, deps);
  }, [anyLoading, deps, depsJson, name, options]);

  useEffect(() => {
    if (!anyLoading) return;
    const key = keyRef.current;
    const interval = setInterval(() => {
      Perf.updateLoading(key, deps);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [anyLoading, deps, depsJson]);
}
