// lib/pkce.ts
// Utilities for PKCE (Proof Key for Code Exchange) and OAuth state management.
// These run server-side only — never expose these functions to the browser.

import { createHash, randomBytes, createHmac } from "crypto";

// --- PKCE ---

/**
 * Generates a cryptographically random code_verifier as per RFC 7636 §4.1.
 * Must have at least 32 bytes of entropy.
 */
export function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

/**
 * Derives the code_challenge from the verifier using S256 method (SHA-256).
 */
export function generateCodeChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// --- State tokens ---
// We sign state values with HMAC-SHA256 so we can verify them on callback
// without needing a database. The state carries the code_verifier inside it.

const SECRET = process.env.STATE_SECRET!;

/**
 * Creates a signed state token that embeds the code_verifier.
 * Format: base64(payload).signature
 */
export function createStateToken(codeVerifier: string): string {
  const payload = Buffer.from(JSON.stringify({ v: codeVerifier, t: Date.now() })).toString(
    "base64url"
  );
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/**
 * Verifies and unpacks a state token.
 * Returns the code_verifier if valid, or null if tampered/expired.
 * Tokens are valid for 10 minutes.
 */
export function verifyStateToken(state: string): string | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;

  const expectedSig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (sig !== expectedSig) return null;

  try {
    const { v, t } = JSON.parse(Buffer.from(payload, "base64url").toString());
    const TEN_MINUTES = 10 * 60 * 1000;
    if (Date.now() - t > TEN_MINUTES) return null;
    return v as string;
  } catch {
    return null;
  }
}
