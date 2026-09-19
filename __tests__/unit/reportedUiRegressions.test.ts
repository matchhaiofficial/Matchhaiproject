import fs from "fs";
import path from "path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("reported UI regressions", () => {
  it("renders the wallet checkout CTA with its active style unless truly disabled", () => {
    const screen = read("app/matchrooms/book/pay/[intentId].tsx");
    const styles = read("app-shared/matchrooms/book/pay/pay.styles.ts");

    expect(screen).toContain("style={[styles.payBtn, payDisabled && styles.payBtnDisabled]}");
    expect(styles).toMatch(/payBtn:\s*\{[\s\S]*backgroundColor:\s*COLORS\.accent/);
    expect(styles).toMatch(/payBtnDisabled:\s*\{[\s\S]*backgroundColor:\s*COLORS\.disabled/);
  });

  it("does not apply a second screen-width inset on My Challenges", () => {
    const styles = read("app-shared/teams/challenges.styles.ts");

    expect(styles).toMatch(/content:\s*\{[\s\S]*paddingHorizontal:\s*0/);
    expect(styles).not.toMatch(/content:\s*\{\s*padding:\s*SPACING\.screenPadding/);
  });

  it("uses the notification id as a unique navigation token and scrolls to its matchroom", () => {
    const notifications = read("app/zone/modules/notifications.tsx");
    const matchrooms = read("app-shared/zone/modules/components/ZoneBookingsMatchroomsSection.tsx");

    expect(notifications).toContain('t: item.id');
    expect(notifications).toContain('matchroomId,');
    expect(matchrooms).toContain("matchrooms.findIndex");
    expect(matchrooms).toContain("scrollToIndex");
  });
});
