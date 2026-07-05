import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * SECURITY MODEL
 * --------------
 * All third-party credentials (OAuth tokens, API keys, IMAP passwords) are
 * stored encrypted at rest using AES-256-GCM. Ciphertext format is
 * `iv:tag:data` (all hex).
 *
 * Historically some tokens were stored in plaintext (notably Google tokens,
 * which were special-cased to skip encryption). That is a security bug. This
 * module no longer special-cases any provider — everything is encrypted.
 *
 * Legacy plaintext rows that still exist in the database must be migrated.
 * Until that migration has run you can temporarily allow plaintext reads by
 * setting ALLOW_PLAINTEXT_TOKEN_FALLBACK=true. In production this defaults to
 * OFF so a decryption failure fails loudly instead of silently handing back a
 * garbage/plaintext value. Run `scripts/migrate-encrypt-tokens.ts` to
 * re-encrypt legacy rows, then remove the flag.
 */

function getKey(): Buffer {
  let key = process.env.ENCRYPTION_KEY?.trim();
  if (!key) {
    key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  }
  // Support both hex and base64 encoded keys
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, "hex");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length === 32) {
    return buf;
  }
  return Buffer.from(key, "hex");
}

function plaintextFallbackAllowed(): boolean {
  // Never silently allow plaintext in production unless explicitly opted in
  // for a one-time migration window.
  return process.env.ALLOW_PLAINTEXT_TOKEN_FALLBACK === "true";
}

/** True if the value is in our `iv:tag:data` hex ciphertext format. */
export function isCiphertext(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  const isHex = (s: string) => /^[0-9a-fA-F]*$/.test(s) && s.length > 0;
  if (!parts.every(isHex)) return false;
  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  return iv.length === IV_LENGTH && tag.length === TAG_LENGTH;
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  // Format: iv:tag:encrypted (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  if (!isCiphertext(ciphertext)) {
    // Legacy plaintext value (not yet migrated).
    if (plaintextFallbackAllowed()) {
      console.warn(
        "[encryption] legacy plaintext token read (ALLOW_PLAINTEXT_TOKEN_FALLBACK=true). Run the re-encryption migration."
      );
      return ciphertext;
    }
    throw new Error(
      "[encryption] value is not encrypted. Run scripts/migrate-encrypt-tokens.ts, " +
        "or set ALLOW_PLAINTEXT_TOKEN_FALLBACK=true for a temporary migration window."
    );
  }

  const parts = ciphertext.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];

  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  // No silent fallback: if authenticated decryption fails the data is
  // corrupt or the key is wrong — surface it instead of returning garbage.
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
