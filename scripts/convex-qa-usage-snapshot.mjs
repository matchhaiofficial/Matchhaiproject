#!/usr/bin/env node

/**
 * Read-only usage snapshot for the MatchHai QA deployment.
 *
 * This intentionally does not accept a deployment override. The command is
 * tied to the shared QA project so a copied command cannot accidentally query
 * production (or a developer's personal deployment).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const QA_TEAM = "shakir-yasin";
const QA_PROJECT = "matchhai-qa";
const QA_DEPLOYMENT = "striped-dog-623";
const QA_BINDING = `dev:${QA_DEPLOYMENT}`;
const QA_URL = `https://${QA_DEPLOYMENT}.convex.cloud`;
const SCHEDULER_SAMPLE_LIMIT = 1000;
const DAILY_FUNCTION_CALL_TRIPWIRE = 15_000;
const DAILY_DATABASE_IO_TRIPWIRE_GB = 1;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function fail(message) {
  console.error(`QA usage snapshot refused: ${message}`);
  process.exitCode = 1;
}

function parseArgs(argv) {
  const args = new Set(argv);
  if (args.size === 1 && args.has("--help")) {
    console.log("Usage: node scripts/convex-qa-usage-snapshot.mjs [--json]");
    console.log(`Target: ${QA_TEAM}:${QA_PROJECT} / ${QA_DEPLOYMENT}`);
    console.log("Read-only; deployment overrides are refused.");
    process.exit(0);
  }
  if (args.has("--json")) args.delete("--json");
  if (args.size > 0) {
    throw new Error("only --json is supported; deployment overrides are not allowed");
  }
  return argv.includes("--json");
}

function readLocalBinding() {
  const localEnvPath = path.join(root, ".env.local");
  let localEnv = "";
  try {
    localEnv = fs.readFileSync(localEnvPath, "utf8");
  } catch {
    // A shell-provided binding is also accepted below. Missing both is unsafe.
  }

  const read = (name) => {
    const shellValue = process.env[name];
    if (shellValue != null && shellValue !== "") return shellValue.trim();
    const match = localEnv.match(new RegExp(`^${name}\\s*=\\s*([^#\\r\\n]+)`, "m"));
    return match?.[1]?.trim() || "";
  };

  return {
    deployment: read("CONVEX_DEPLOYMENT"),
    url: read("EXPO_PUBLIC_CONVEX_URL"),
    deploymentClass: read("EXPO_PUBLIC_CONVEX_DEPLOYMENT_CLASS"),
  };
}

function assertQaBinding() {
  const binding = readLocalBinding();
  if (binding.deployment !== QA_BINDING) {
    throw new Error(`CONVEX_DEPLOYMENT must be exactly ${QA_BINDING}`);
  }
  if (binding.url && binding.url !== QA_URL) {
    throw new Error(`EXPO_PUBLIC_CONVEX_URL must be exactly ${QA_URL}`);
  }
  if (binding.deploymentClass && binding.deploymentClass !== "qa") {
    throw new Error("EXPO_PUBLIC_CONVEX_DEPLOYMENT_CLASS must be qa");
  }
}

function runConvexRaw(label, args) {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(executable, ["--no-install", "convex", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    // Do not echo CLI stderr: it can contain URLs, request details, or other
    // deployment metadata that is not part of the safe snapshot output.
    throw new Error(`${label} failed; check Convex CLI authentication locally`);
  }
  // `convex deployments` prints its human-readable identity to stderr while
  // JSON-producing commands print to stdout. Prefer stdout and fall back to
  // stderr for that identity-only command.
  return String(result.stdout || result.stderr || "").trim();
}

function runConvex(label, args) {
  try {
    return JSON.parse(runConvexRaw(label, args));
  } catch {
    throw new Error(`${label} returned non-JSON output`);
  }
}

function assertCliProject() {
  const output = runConvexRaw("deployment identity", ["deployments"]);
  const team = output.match(/^\s*Team:\s*(\S+)\s*$/m)?.[1];
  const project = output.match(/^\s*Project:\s*(\S+)\s*$/m)?.[1];
  const deployment = output.match(/^\s*Deployment:\s*(\S+)\s*$/m)?.[1];
  const type = output.match(/^\s*Type:\s*(\S+)\s*$/m)?.[1];
  if (
    team !== QA_TEAM
    || project !== QA_PROJECT
    || deployment !== QA_DEPLOYMENT
    || type !== "dev"
  ) {
    throw new Error("Convex CLI is not bound to the fixed MatchHai QA deployment");
  }
}

const SCHEDULER_QUERY = `
  const rows = await ctx.db.system.query("_scheduled_functions").take(${SCHEDULER_SAMPLE_LIMIT});
  const pendingRows = rows.filter((row) => row.state?.kind === "pending");
  const pendingByFunction = {};
  for (const row of pendingRows) {
    const name = typeof row.name === "string" ? row.name : "unknown";
    pendingByFunction[name] = (pendingByFunction[name] || 0) + 1;
  }
  return {
    sampledRows: rows.length,
    sampleLimit: ${SCHEDULER_SAMPLE_LIMIT},
    sampleTruncated: rows.length === ${SCHEDULER_SAMPLE_LIMIT},
    pendingRows: pendingRows.length,
    duePendingRows: pendingRows.filter(
      (row) => typeof row.scheduledTime === "number" && row.scheduledTime <= Date.now(),
    ).length,
    pendingByFunction,
  };
`;

function metricUsage(usage, metric) {
  return {
    day: usage?.metrics?.[metric]?.usage?.current_day ?? null,
    month: usage?.metrics?.[metric]?.usage?.current_month ?? null,
  };
}

function makeAlerts(usage, scheduler) {
  const alerts = [];
  if (scheduler.sampleTruncated) alerts.push("scheduler_sample_truncated");
  if (scheduler.duePendingRows > 0) alerts.push("due_pending_jobs");

  const functionCalls = usage.functionCalls.day;
  if (typeof functionCalls === "number" && functionCalls >= DAILY_FUNCTION_CALL_TRIPWIRE) {
    alerts.push("daily_function_call_tripwire");
  }
  const databaseIoGb = usage.databaseIoGb.day;
  if (typeof databaseIoGb === "number" && databaseIoGb >= DAILY_DATABASE_IO_TRIPWIRE_GB) {
    alerts.push("daily_database_io_tripwire");
  }
  return alerts;
}

function main() {
  const json = parseArgs(process.argv.slice(2));
  assertQaBinding();
  assertCliProject();

  const usageRaw = runConvex("deployment usage", [
    "deployment",
    "usage",
    "--json",
    "--deployment",
    QA_DEPLOYMENT,
  ]);
  const scheduler = runConvex("scheduler query", [
    "run",
    "--deployment",
    QA_DEPLOYMENT,
    "--inline-query",
    SCHEDULER_QUERY,
    "--typecheck",
    "disable",
    "--codegen",
    "disable",
  ]);

  const snapshot = {
    target: `${QA_TEAM}:${QA_PROJECT} / ${QA_DEPLOYMENT}`,
    readOnly: true,
    sampledAt: new Date().toISOString(),
    scheduler: {
      sampledRows: scheduler.sampledRows,
      sampleLimit: scheduler.sampleLimit,
      sampleTruncated: scheduler.sampleTruncated,
      pendingRows: scheduler.pendingRows,
      duePendingRows: scheduler.duePendingRows,
      pendingByFunction: scheduler.pendingByFunction,
    },
    usage: {
      functionCalls: metricUsage(usageRaw, "functionCalls"),
      databaseIoGb: metricUsage(usageRaw, "databaseIoGb"),
    },
    thresholds: {
      dailyFunctionCallsTripwire: DAILY_FUNCTION_CALL_TRIPWIRE,
      dailyDatabaseIoGbTripwire: DAILY_DATABASE_IO_TRIPWIRE_GB,
    },
  };
  snapshot.alerts = makeAlerts(snapshot.usage, snapshot.scheduler);

  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  console.log(`MatchHai QA usage snapshot (${snapshot.sampledAt})`);
  console.log(`Target: ${snapshot.target}`);
  console.log(`Scheduler rows sampled: ${snapshot.scheduler.sampledRows}/${snapshot.scheduler.sampleLimit}`);
  console.log(`Pending jobs: ${snapshot.scheduler.pendingRows}; due now: ${snapshot.scheduler.duePendingRows}`);
  console.log(`Function calls today/month: ${snapshot.usage.functionCalls.day}/${snapshot.usage.functionCalls.month}`);
  console.log(`Database I/O GB today/month: ${snapshot.usage.databaseIoGb.day}/${snapshot.usage.databaseIoGb.month}`);
  console.log(`Alerts: ${snapshot.alerts.length ? snapshot.alerts.join(", ") : "none"}`);
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : "unexpected error");
}
