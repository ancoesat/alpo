// Server-only session helpers: sign/verify a small, tamper-proof login cookie.
// No external libraries — uses the Web Crypto API, which works in both the
// Next.js Middleware (Edge) runtime and normal server (Node) runtime.

const SESSION_COOKIE_NAME = "kbyte_session";
const SHORT_SESSION_SECONDS = 60 * 60 * 24; // 1 day (default, box unchecked)
const LONG_SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 days ("keep me logged in")

export const SESSION_COOKIE = SESSION_COOKIE_NAME;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Returned as a plain ArrayBuffer-backed Uint8Array (not SharedArrayBuffer-backed),
// which is what the Web Crypto API's BufferSource parameters require.
function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padLength = (4 - (value.length % 4)) % 4;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getSigningKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set.");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Creates a signed "<payload>.<signature>" token. The payload just carries
// an expiry timestamp — there's nothing else to store for a single-user app.
export async function createSessionToken(
  rememberMe: boolean
): Promise<{ value: string; maxAgeSeconds: number }> {
  const maxAgeSeconds = rememberMe ? LONG_SESSION_SECONDS : SHORT_SESSION_SECONDS;
  const payload = JSON.stringify({ exp: Date.now() + maxAgeSeconds * 1000 });
  const payloadB64 = bytesToBase64Url(new TextEncoder().encode(payload));

  const key = await getSigningKey();
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const signatureB64 = bytesToBase64Url(new Uint8Array(signatureBytes));

  return { value: `${payloadB64}.${signatureB64}`, maxAgeSeconds };
}

// Verifies the signature AND checks the token hasn't expired.
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const [payloadB64, signatureB64] = token.split(".");
  if (!payloadB64 || !signatureB64) return false;

  try {
    const key = await getSigningKey();
    const isSignatureValid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signatureB64),
      new TextEncoder().encode(payloadB64)
    );
    if (!isSignatureValid) return false;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64))) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

// Constant-time string compare, so checking the login password doesn't leak
// "how many characters matched" through response timing.
export function timingSafeStringEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

// Same cookie settings for password and Google sign-in.
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
