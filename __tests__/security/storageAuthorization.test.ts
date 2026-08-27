import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("storage authorization boundaries", () => {
  it("does not expose ownership-blind generic storage operations", () => {
    const storageSource = read("convex/storage.ts");

    expect(storageSource).toContain("rejectDeprecatedStorageEndpoint");
    expect(storageSource).not.toContain("ctx.storage.generateUploadUrl()");
    expect(storageSource).not.toContain("ctx.storage.getUrl(args.storageId)");
    expect(storageSource).not.toContain("ctx.storage.delete(args.storageId)");
    expect(storageSource).not.toContain("ctx.db.system.get(args.storageId)");
  });

  it("does not route application uploads through the generic storage API", () => {
    const serviceSource = read("src/services/convex/storageService.ts");

    expect(serviceSource).not.toContain("api.storage.generateUploadUrl");
    expect(serviceSource).not.toContain("api.storage.getFileUrl");
  });

  it("uses resource-scoped authorization before issuing upload URLs", () => {
    const matchroomChat = read("convex/chat.ts");
    const friendChat = read("convex/friendChat.ts");
    const teamChat = read("convex/teamChat.ts");
    const challengeChat = read("convex/teamChallengeChat.ts");
    const kyc = read("convex/kyc.ts");

    expect(matchroomChat).toContain("await requireAuthorizedChatroomParticipant(ctx, args.chatroomId)");
    expect(matchroomChat).toContain("await requireAuthorizedMatchroomParticipant(ctx, args.matchroomId)");
    expect(friendChat).toContain("const userId = await getStrictAuthenticatedUserId(ctx)");
    expect(friendChat).toContain("if (!chatroom.participantUids.includes(String(userId)))");
    expect(teamChat).toContain("await requireTeamMember(ctx, args.teamId)");
    expect(challengeChat).toContain("await requireChatParticipant(ctx, args.chatId)");
    expect(kyc).toContain("export const generateProfileImageUploadUrl = mutation({");
    expect(kyc).toContain("const authId = await getAuthIdFromContextOrSessionToken(ctx, args.sessionToken)");
  });
});
