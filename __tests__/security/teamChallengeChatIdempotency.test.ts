import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("team challenge chat idempotency regression guard", () => {
  it("returns a same-sender clientMessageId duplicate before side effects", () => {
    const source = read("convex/teamChallengeChat.ts");

    const duplicateCheck = source.indexOf("message.clientMessageId === args.clientMessageId");
    const senderScope = source.indexOf("String(message.senderUid) === String(userId)");
    const duplicateReturn = source.indexOf("return duplicate._id;");
    const insertMessage = source.indexOf('ctx.db.insert("teamChallengeChatMessages"');
    const updateUnreadCounts = source.indexOf("updateChallengeUnreadCounts(ctx, args.chatId, userId, now)");
    const schedulePush = source.indexOf("ctx.scheduler.runAfter");

    expect(duplicateCheck).toBeGreaterThan(-1);
    expect(senderScope).toBeGreaterThan(duplicateCheck);
    expect(duplicateReturn).toBeGreaterThan(senderScope);
    expect(duplicateReturn).toBeLessThan(insertMessage);
    expect(duplicateReturn).toBeLessThan(updateUnreadCounts);
    expect(duplicateReturn).toBeLessThan(schedulePush);
  });
});
