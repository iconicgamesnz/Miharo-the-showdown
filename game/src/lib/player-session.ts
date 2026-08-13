/**
 * Device-local identity. Guests never need accounts, so the phone keeps a
 * token that proves which seat in the room belongs to it. Tokens are stored
 * hashed server-side and are only ever sent to our own server functions.
 */

const PLAYER_KEY = (code: string) => `iconic:player:${code.toUpperCase()}`;
const HOST_KEY = (code: string) => `iconic:host:${code.toUpperCase()}`;

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) — session simply won't persist */
  }
}

export const getPlayerToken = (code: string) => safeGet(PLAYER_KEY(code));
export const setPlayerToken = (code: string, token: string) => safeSet(PLAYER_KEY(code), token);
export const getHostToken = (code: string) => safeGet(HOST_KEY(code));
export const setHostToken = (code: string, token: string) => safeSet(HOST_KEY(code), token);

export function clearPlayerToken(code: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PLAYER_KEY(code));
  } catch {
    /* noop */
  }
}
