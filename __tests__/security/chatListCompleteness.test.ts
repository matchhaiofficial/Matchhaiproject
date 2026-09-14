import fs from "fs";
import path from "path";

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("chat-list identity and unread aggregation contracts", () => {
  it("projects participant identities and avatars for matchroom and challenge rows", () => {
    expect(read("convex/chat.ts")).toContain("participantProfiles");
    expect(read("convex/chat.ts")).toContain("avatarURL");
    expect(read("convex/teamChallengeChat.ts")).toContain("participantProfiles");
    expect(read("convex/teamChallengeChat.ts")).toContain("avatarURL");
    expect(read("convex/friendChat.ts")).toContain("avatarURL: friendPhotoURL");
  });

  it("includes team and team-challenge conversations with server unread counts", () => {
    const list = read("app/(player)/chatrooms.tsx");
    expect(list).toContain("api.teamChat.listForMe");
    expect(list).toContain("api.teamChallengeChat.listForMe");
    expect(list).toContain("conversation.kind === \"team\"");
    expect(read("convex/teamChat.ts")).toContain("export const listForMe = query");
    expect(read("convex/teamChat.ts")).toContain("unreadCount: member ? Number(member.unreadCount || 0) : legacyUnreadCount");
  });

  it("keeps team chat unread state server-owned on send and read", () => {
    const teamChat = read("convex/teamChat.ts");
    expect(teamChat).toContain('withIndex("by_chatroomId", (q: any) => q.eq("chatroomId", chatroom!._id))');
    expect(teamChat).toContain("unreadCount: String(member.userId) === String(state.userId) ? 0");
    expect(teamChat).toContain("unreadCount: 0, lastReadAt: Date.now()");
  });
});
