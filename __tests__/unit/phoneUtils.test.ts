// Phase 1 (profile/registration helpers) — Pakistani phone normalize/format/validate.
import {
  normalizePakistaniPhone,
  formatPakistaniPhone,
  isValidPakistaniPhone,
} from "../../src/utils/phoneUtils";

describe("normalizePakistaniPhone", () => {
  it("normalizes the common input formats to E164 + digits", () => {
    for (const input of ["03001234567", "+92 300 1234567", "923001234567", "0092 300 1234567"]) {
      const { phoneE164, phoneDigits } = normalizePakistaniPhone(input);
      expect(phoneDigits).toBe("3001234567");
      expect(phoneE164).toBe("+923001234567");
    }
  });

  it("returns empty for invalid/short numbers", () => {
    expect(normalizePakistaniPhone("123").phoneE164).toBe("");
    expect(normalizePakistaniPhone("").phoneDigits).toBe("");
  });
});

describe("isValidPakistaniPhone", () => {
  it("accepts valid 03xx mobile numbers", () => {
    expect(isValidPakistaniPhone("03001234567")).toBe(true);
    expect(isValidPakistaniPhone("+923211234567")).toBe(true);
  });
  it("rejects non-mobile / malformed numbers", () => {
    expect(isValidPakistaniPhone("0211234567")).toBe(false); // does not start with 3
    expect(isValidPakistaniPhone("12345")).toBe(false);
  });
});

describe("formatPakistaniPhone", () => {
  it("formats local 03xx numbers with spacing", () => {
    expect(formatPakistaniPhone("03001234567")).toBe("0300 1234 567");
  });
  it("formats +92 numbers", () => {
    expect(formatPakistaniPhone("+923001234567")).toBe("+92 300 1234 567");
  });
});
