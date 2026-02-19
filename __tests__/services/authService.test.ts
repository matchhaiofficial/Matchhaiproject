import {
  signInWithEmail,
  signUpWithEmail,
  sendPasswordReset,
  signOutUser,
} from "../../src/services/authService";

jest.mock("../../src/config/firebaseConfig", () => ({
  auth: { currentUser: null },
  db: {},
}));

const mockAuth = jest.requireMock("../../src/config/firebaseConfig").auth;

const mockCreateUserWithEmailAndPassword = jest.fn();
const mockSendPasswordResetEmail = jest.fn();
const mockSignInWithEmailAndPassword = jest.fn();
const mockSignOut = jest.fn();
const mockUpdateProfile = jest.fn();

jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: (...args) =>
    mockCreateUserWithEmailAndPassword(...args),
  sendPasswordResetEmail: (...args) => mockSendPasswordResetEmail(...args),
  signInWithEmailAndPassword: (...args) => mockSignInWithEmailAndPassword(...args),
  signOut: (...args) => mockSignOut(...args),
  updateProfile: (...args) => mockUpdateProfile(...args),
}));

const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockGetDocs = jest.fn();
const mockDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockServerTimestamp = jest.fn(() => "serverTime");

jest.mock("firebase/firestore", () => ({
  collection: (...args) => mockCollection(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  getDocs: (...args) => mockGetDocs(...args),
  doc: (...args) => mockDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

describe("authService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("signs in with email when input contains @", async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: { uid: "u1" } });
    const res = await signInWithEmail("test@example.com", "pw");
    expect(res.ok).toBe(true);
    expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
      mockAuth,
      "test@example.com",
      "pw"
    );
  });

  it("signs in with phone by looking up email", async () => {
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ email: "phone@example.com" }) }],
    });
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: { uid: "u2" } });
    const res = await signInWithEmail("03001234567", "pw");
    expect(res.ok).toBe(true);
    expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
      mockAuth,
      "phone@example.com",
      "pw"
    );
  });

  it("returns friendly error for invalid email", async () => {
    mockCreateUserWithEmailAndPassword.mockRejectedValue({ code: "auth/invalid-email" });
    const res = await signUpWithEmail("bad", "pw");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toBe("Invalid email address.");
  });

  it("sends password reset email", async () => {
    mockSendPasswordResetEmail.mockResolvedValue({});
    const res = await sendPasswordReset("test@example.com");
    expect(res.ok).toBe(true);
  });

  it("returns friendly error on sign out failure", async () => {
    mockSignOut.mockRejectedValue({ code: "auth/network-request-failed" });
    const res = await signOutUser();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toBe("Network error. Check your connection and try again.");
  });
});
