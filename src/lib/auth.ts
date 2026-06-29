import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "session";
const TOKEN_EXPIRY_DAYS = 7;

const getAuthSecret = () => {
  return process.env.AUTH_SECRET || "tinix-default-secret-key-32-chars-long-or-longer!";
};

/**
 * PBKDF2 Password Hashing using standard Web Crypto API (available in Edge and Node).
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = encoder.encode(salt);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 10000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    true,
    ["sign"]
  );

  const rawKey = await crypto.subtle.exportKey("raw", derivedKey);
  return arrayBufferToHex(rawKey);
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return arrayBufferToHex(arr.buffer);
}

/**
 * Custom JWT-like token using Web Crypto HMAC-SHA256.
 * Format: base64(payload).base64(signature)
 */
export async function signToken(payload: Record<string, any>): Promise<string> {
  const secret = getAuthSecret();
  const encoder = new TextEncoder();
  const payloadStr = JSON.stringify(payload);
  
  // Base64URL encode payload
  const payloadBase64 = btoa(payloadStr)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const secretBuffer = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    secretBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payloadBase64)
  );

  // Base64URL encode signature
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${payloadBase64}.${signatureBase64}`;
}

export async function verifyToken(token: string | undefined): Promise<Record<string, any> | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadBase64, signatureBase64] = parts;
  const secret = getAuthSecret();
  const encoder = new TextEncoder();

  try {
    const secretBuffer = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      secretBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Reconstruct signature to raw buffer
    const sigBinary = atob(signatureBase64.replace(/-/g, "+").replace(/_/g, "/"));
    const sigBuffer = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) {
      sigBuffer[i] = sigBinary.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBuffer,
      encoder.encode(payloadBase64)
    );

    if (!isValid) return null;

    const payloadStr = atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadStr);

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Cookie session management.
 * Note: cookies() can only be modified in API Routes or Server Actions.
 */
export async function setSessionCookie(payload: Record<string, any>) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_DAYS * 24 * 60 * 60;
  const token = await signToken({ ...payload, exp });
  
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession(): Promise<Record<string, any> | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifyToken(token);
}
