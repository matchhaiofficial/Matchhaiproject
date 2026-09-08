import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("notification P0 regression guards", () => {
  it("push device registration is authenticated and does not persist client-owned userId", () => {
    const source = read("convex/pushNotifications.ts");

    expect(source).toContain("requireCurrentUser(ctx)");
    expect(source).toContain("Push device registration must match the authenticated user.");
    expect(source).toContain("userId: user._id");
    expect(source).not.toContain("userId: args.userId");
  });

  it("super-admin notification recipients include canonical, legacy, and account-type admins", () => {
    const source = read("convex/superAdminAccess.ts");

    expect(source).toContain("listSuperAdminNotificationRecipients");
    expect(source).toContain('q.eq("role", SUPER_ADMIN_ROLE)');
    expect(source).toContain('q.eq("role", LEGACY_SUPER_ADMIN_ROLE)');
    expect(source).toContain('q.eq("accountType", SUPER_ADMIN_ROLE)');
    expect(source).toContain("getSuperAdminAllowlist()");
    expect(source).toContain('withIndex("by_email"');
  });

  it("keeps legacy Team Challenge endpoints behind canonical security and result workflows", () => {
    const source = read("convex/teamChallenges.ts");

    expect(source).toContain("Backwards-compatible free/social challenge");
    expect(source).toContain("const actorId = await getAuthenticatedUserId(ctx, challenger.captainUid)");
    expect(source).toContain("await assertTeamParticipantsCanShareMatchroom(ctx, challenger, opponent)");
    expect(source).toContain('paymentMode: "free" as const');
    expect(source).toContain("await ctx.runMutation(api.matchrooms.submitCaptainReport");
    expect(source).not.toContain('status: "completed",\n      result: {\n        winnerId: args.winnerId');
  });
});
