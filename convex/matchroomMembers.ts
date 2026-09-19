import { Id } from "./_generated/dataModel";

// Keep the player-to-room index exactly aligned with the canonical playerUids
// array. All matchroom writers must call this after creating or changing a
// roster so indexed schedules, deletion checks, and "My matchrooms" stay sound.
export async function syncMatchroomMembers(
  ctx: any,
  matchroomId: Id<"matchrooms">,
  playerUids: string[],
) {
  const desired = new Set((playerUids || []).map(String).filter(Boolean));
  const existing = await ctx.db
    .query("matchroomMembers")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .collect();
  const existingUids = new Set<string>();
  for (const row of existing) {
    const uid = String(row.uid);
    existingUids.add(uid);
    if (!desired.has(uid)) await ctx.db.delete(row._id);
  }
  for (const uid of desired) {
    if (!existingUids.has(uid)) {
      await ctx.db.insert("matchroomMembers", { matchroomId, uid, createdAt: Date.now() });
    }
  }
}
