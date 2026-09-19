import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const root = path.resolve(__dirname, "../..");
const scriptPath = path.join(root, "scripts/convex-qa-usage-snapshot.mjs");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Convex QA usage snapshot contracts", () => {
  it("is fixed to the shared QA project and samples the system scheduler read-only", () => {
    const source = read("scripts/convex-qa-usage-snapshot.mjs");

    expect(source).toContain('const QA_TEAM = "shakir-yasin"');
    expect(source).toContain('const QA_PROJECT = "matchhai-qa"');
    expect(source).toContain('const QA_DEPLOYMENT = "striped-dog-623"');
    expect(source).toContain('const SCHEDULER_SAMPLE_LIMIT = 1000');
    expect(source).toContain('ctx.db.system.query("_scheduled_functions")');
    expect(source).toContain(".take(${SCHEDULER_SAMPLE_LIMIT})");
    expect(source).toContain('"deployment",\n    "usage"');
    expect(source).toContain('"deployments"]');
    expect(source).toContain('"--no-install", "convex"');

    expect(source).not.toContain(".collect()");
    expect(source).not.toMatch(/ctx\.scheduler\.(runAt|runAfter|cancel)/);
    expect(source).not.toContain('"--push"');
    expect(source).not.toContain('"--prod"');
    expect(source).not.toContain("row.args");
    expect(source).not.toContain("row._id");
  });

  it("refuses a deployment override before any CLI call", () => {
    const result = spawnSync(
      process.execPath,
      [scriptPath, "--deployment", "prod"],
      { cwd: root, encoding: "utf8" },
    );
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain("deployment overrides are not allowed");
    expect(output).not.toContain("deployment usage");
  });

  it("keeps the canary procedure tied to explicit bounded thresholds", () => {
    const docs = read("docs/CONVEX_QA_USAGE_SNAPSHOT.md");
    expect(docs).toContain("15 calls / 5 minutes");
    expect(docs).toContain("0.05 GB / 5 minutes");
    expect(docs).toContain("100 calls / 5 minutes");
    expect(docs).toContain("0.10 GB / 5 minutes");
    expect(docs).toContain("15,000 function calls");
    expect(docs).toContain("1 GB database");
    expect(docs).toContain("I/O**");
  });
});
