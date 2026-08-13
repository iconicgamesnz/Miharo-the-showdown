/**
 * Server-only room helpers. Never imported by client code directly.
 */
import { ROOM_RULES } from "@/config/rounds";

/** Ambiguous characters (0/O, 1/I) removed so codes read cleanly on a TV. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = ROOM_RULES.codeLength): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

export function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

/**
 * Tokens are stored hashed. A device proves identity by presenting its token;
 * the database never holds a value that would let a leaked row impersonate a
 * player.
 */
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function sanitizeNickname(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 14);
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}
