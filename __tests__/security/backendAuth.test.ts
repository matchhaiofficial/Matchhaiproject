// Phase 5 (7,8) — backend authorization gates (negative-auth) using a fake ctx.
// These exercise convex/authz.ts directly: an unauthenticated/non-privileged
// actor must be rejected. No Convex deployment or DB is required — we inject a
// minimal fake ctx (auth + db).
//
// convex/auth.ts pulls the better-auth ESM chain which Jest cannot transform, so
// we mock the local auth module. authz only uses authComponent.getAuthUser, which
// getCurrentUser already guards in try/catch — returning null here is realistic.
jest.mock("../../convex/auth", () => ({
  authComponent: {
    getAuthUser: jest.fn(async () => null),
  },
}));

import {
  requireCurrentUser,
  requireSuperAdmin,
  requireSelf,
  requireOwnedZone,
  publicUser,
} from "../../convex/authz";

type FakeOpts = {
  identity?: any;
  user?: any;
  zone?: any;
};

function fakeCtx({ identity = null, user = null, zone = null }: FakeOpts) {
  return {
    auth: {
      getUserIdentity: async () => identity,
    },
    db: {
      query: () => ({
        withIndex: () => ({
          unique: async () => user,
        }),
      }),
      get: async () => zone,
    },
  } as any;
}

const playerUser = { _id: "user_player", role: "player", email: "player@test.com" };
const adminUser = { _id: "user_admin", role: "super_admin", email: "admin@test.com" };
const authedIdentity = { subject: "auth|123", tokenIdentifier: "iss|123", email: "player@test.com" };

describe("requireCurrentUser", () => {
  it("rejects an unauthenticated caller", async () => {
    await expect(requireCurrentUser(fakeCtx({ identity: null, user: null }))).rejects.toThrow(
      /Unauthenticated/,
    );
  });

  it("rejects an authenticated token with no matching user profile", async () => {
    await expect(
      requireCurrentUser(fakeCtx({ identity: authedIdentity, user: null })),
    ).rejects.toThrow(/profile not found/i);
  });

  it("returns the actor when authenticated with a profile", async () => {
    const actor = await requireCurrentUser(fakeCtx({ identity: authedIdentity, user: playerUser }));
    expect(actor.user._id).toBe("user_player");
  });
});

describe("requireSuperAdmin (negative)", () => {
  it("rejects a normal player even when authenticated", async () => {
    await expect(
      requireSuperAdmin(fakeCtx({ identity: authedIdentity, user: playerUser })),
    ).rejects.toThrow(/Super admin access required/);
  });

  it("allows a real super_admin", async () => {
    const actor = await requireSuperAdmin(
      fakeCtx({ identity: { ...authedIdentity, email: "admin@test.com" }, user: adminUser }),
    );
    expect(actor.user.role).toBe("super_admin");
  });
});

describe("requireSelf (negative)", () => {
  it("rejects acting on another user's id", async () => {
    await expect(
      requireSelf(fakeCtx({ identity: authedIdentity, user: playerUser }), "user_someone_else" as any),
    ).rejects.toThrow(/Not authorized/);
  });

  it("allows acting on your own id", async () => {
    const actor = await requireSelf(
      fakeCtx({ identity: authedIdentity, user: playerUser }),
      "user_player" as any,
    );
    expect(actor.user._id).toBe("user_player");
  });
});

describe("requireOwnedZone (wrong zone admin)", () => {
  it("rejects a zone admin acting on a zone they do not own", async () => {
    const zoneOwnedByOther = { _id: "zone_x", ownerUid: "user_other_admin" };
    await expect(
      requireOwnedZone(
        fakeCtx({ identity: authedIdentity, user: playerUser, zone: zoneOwnedByOther }),
        "zone_x" as any,
      ),
    ).rejects.toThrow(/Not authorized for this zone/);
  });

  it("allows the true owner", async () => {
    const ownZone = { _id: "zone_player", ownerUid: "user_player" };
    const res = await requireOwnedZone(
      fakeCtx({ identity: authedIdentity, user: playerUser, zone: ownZone }),
      "zone_player" as any,
    );
    expect(res.zone._id).toBe("zone_player");
  });
});

describe("publicUser projection (privacy)", () => {
  it("never leaks tokens / secrets / raw provider payloads", () => {
    const fullUser = {
      _id: "u1",
      username: "ace",
      fullName: "Ace Player",
      email: "ace@test.com",
      phone: "+923001234567",
      cnic: "42101-1234567-1",
      bankAccount: "PK00XXXX",
      authToken: "secret-token",
      psnStats: {
        psnOnlineId: "ace_psn",
        fc: { progress: 70, rawTrophyBlob: "DO NOT LEAK" },
        avatarUrl: "https://leak",
      },
    };
    const out = publicUser(fullUser) as any;
    expect(out.username).toBe("ace");
    // Sensitive fields must be absent from the public projection.
    for (const key of ["email", "phone", "cnic", "bankAccount", "authToken"]) {
      expect(out[key]).toBeUndefined();
    }
    // PSN exposed as progress only — no raw provider payload / avatar URL.
    expect(out.psnStats.fc).toEqual({ progress: 70 });
    expect(out.psnStats.avatarUrl).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain("DO NOT LEAK");
  });

  it("returns null for a missing user", () => {
    expect(publicUser(null)).toBeNull();
  });
});
