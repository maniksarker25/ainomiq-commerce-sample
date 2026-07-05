import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt, isCiphertext } from "../encryption";

// Deterministic 32-byte key for tests
beforeAll(() => {
  process.env.ENCRYPTION_KEY = "0".repeat(64);
  process.env.ALLOW_PLAINTEXT_TOKEN_FALLBACK = "false";
});

describe("encryption", () => {
  it("round-trips a value", () => {
    const secret = "ya29.super-secret-google-token";
    const ct = encrypt(secret);
    expect(ct).not.toBe(secret);
    expect(isCiphertext(ct)).toBe(true);
    expect(decrypt(ct)).toBe(secret);
  });

  it("encrypts Google tokens too (no plaintext shortcut)", () => {
    // Regression test for the old bug where ya29./1// tokens were stored plaintext.
    const ct = encrypt("1//refresh-token-value");
    expect(isCiphertext(ct)).toBe(true);
    expect(decrypt(ct)).toBe("1//refresh-token-value");
  });

  it("produces different ciphertext each time (random IV)", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("throws on legacy plaintext when fallback is disabled", () => {
    expect(() => decrypt("ya29.plaintext-legacy-token")).toThrow();
  });

  it("returns plaintext when fallback is explicitly enabled", () => {
    process.env.ALLOW_PLAINTEXT_TOKEN_FALLBACK = "true";
    expect(decrypt("ya29.plaintext-legacy-token")).toBe("ya29.plaintext-legacy-token");
    process.env.ALLOW_PLAINTEXT_TOKEN_FALLBACK = "false";
  });

  it("throws on tampered ciphertext instead of silently returning it", () => {
    const ct = encrypt("value");
    const tampered = ct.slice(0, -2) + (ct.endsWith("00") ? "11" : "00");
    expect(() => decrypt(tampered)).toThrow();
  });
});
