import "server-only";

import { cookies } from "next/headers";

/**
 * Sessions are a signed cookie, not a database table.
 *
 * The signature is HMAC-SHA256 via Web Crypto, which runs unchanged in both the
 * Node runtime (Server Actions, pages) and the Edge runtime (middleware). That
 * matters: middleware must be able to reject an unauthenticated request without
 * a database round trip on every navigation.
 *
 * The cookie carries only what the UI needs to render a header. Anything that
 * grants permission is re-checked server-side against the database.
 */

export const SESSION_COOKIE = "uf_session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

export interface SessionPayload {
  userId: string;
  name: string;
  loginId: string;
  role: "ADMIN" | "ACCOUNTANT" | "CONTACT" | "PORTAL";
  /** Unix seconds. */
  exp: number;
}

function secretKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short (need 16+ characters).");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Returns Uint8Array<ArrayBuffer> rather than the looser Uint8Array<ArrayBufferLike>
// that Uint8Array.from infers, which crypto.subtle will not accept as a BufferSource.
function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await secretKey(), new TextEncoder().encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/**
 * Returns null for anything wrong -- bad signature, malformed, or expired.
 * Never throws, because a tampered cookie is a logged-out user, not a 500.
 */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await secretKey(),
      fromBase64Url(signature),
      new TextEncoder().encode(body),
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function startSession(user: Omit<SessionPayload, "exp">) {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** The session, or null. Use in layouts and pages that tolerate anonymity. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/**
 * The session, or throw. Every Server Action that writes calls this -- the
 * middleware guards navigation, but a Server Action is a public POST endpoint
 * and must authenticate itself.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "ADMIN") throw new Error("This action requires an administrator.");
  return session;
}
