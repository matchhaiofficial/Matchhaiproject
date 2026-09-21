import fs from "fs";
import path from "path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("deterministic QA control seed", () => {
  it("adds operating hours to both future and existing realistic venues", () => {
    const source = read("convex/demoSeed.ts");
    const realisticZoneSeed = source.slice(
      source.indexOf("export const seedKarachiRealisticZoneByIndex"),
      source.indexOf("export const seedKarachiRealisticDemo"),
    );
    const repair = source.slice(
      source.indexOf("export const repairKarachiRealisticOperatingHours"),
      source.indexOf("type KarachiRealisticRemoveCursor"),
    );

    expect(realisticZoneSeed).toContain("operatingHours: createDefaultBranchOperatingHours()");
    expect(repair).toContain('.withIndex("by_seedSource"');
    expect(repair).toContain(".take(100)");
    expect(repair).not.toContain(".collect()");
    expect(repair).toContain("restricted to QA/development runtimes");
  });

  it("normalizes the admin and establishes exact game rosters", () => {
    const source = read("convex/qaControlSeed.ts");

    expect(source).toContain('accountType: "super_admin"');
    expect(source).toContain('role: "super_admin"');
    expect(source).toContain("hiddenFromPublic: true");
    expect(source).toContain('name: "QA Control CS2 Alpha"');
    expect(source).toContain('name: "QA Control CS2 Bravo"');
    expect(source).toContain('name: "QA Control Tekken Alpha"');
    expect(source).toContain('name: "QA Control Tekken Bravo"');
    expect(source).toContain('name: "QA Control FC Alpha"');
    expect(source).toContain('name: "QA Control FC Bravo"');
    expect(source).toContain("memberEmails: CS2_EMAILS.slice(0, 5)");
    expect(source).toContain("memberEmails: TEKKEN_EMAILS.slice(0, 2)");
    expect(source).toContain("memberEmails: FC_EMAILS.slice(0, 2)");
  });

  it("does not seed recurring or one-shot lifecycle work", () => {
    const source = read("convex/qaControlSeed.ts");

    expect(source).not.toContain("scheduler.runAfter");
    expect(source).not.toContain("scheduler.runAt");
    expect(source).not.toContain('ctx.db.insert("matchrooms"');
    expect(source).not.toContain('ctx.db.insert("teamChallenges"');
  });

  it("keeps cleanup narrow and refuses unsafe account targets", () => {
    const source = read("convex/qaControlSeed.ts");

    expect(source).toContain('room.bookingSource !== "seed"');
    expect(source).toContain('host?.email?.startsWith("demo.player")');
    expect(source).toContain("team.name.startsWith(QA_TEAM_PREFIX)");
    expect(source).toContain('captain?.email?.startsWith("demo.player")');
    expect(source).toContain("Unknown QA control account");
    expect(source).toContain("restricted to QA/development runtimes");
  });
});
