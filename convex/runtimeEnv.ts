declare const process: {
  env: Record<string, string | undefined>;
};

export function getRuntimeEnv(name: string): string | undefined {
  return process.env[name];
}

export function isRuntimeFlagEnabled(name: string): boolean {
  return getRuntimeEnv(name) === "1";
}

export function isMaintenanceJobEnabled(jobFlag: string): boolean {
  return (
    isRuntimeFlagEnabled("MATCHHAI_ENABLE_MAINTENANCE_CRONS") &&
    isRuntimeFlagEnabled(jobFlag)
  );
}
