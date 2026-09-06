import type { Session } from "@/lib/types"

/**
 * The signed-in user, kept in localStorage.
 *
 * localStorage is readable by any JavaScript on the page, so a cross-site scripting bug
 * would expose the token. An httpOnly cookie would not have that weakness, but it cannot
 * be read from JavaScript at all, which means a proxy layer and cookie plumbing. For an
 * assessment app the simpler, explainable option wins - the trade-off is stated rather
 * than hidden.
 */

const STORAGE_KEY = "leave-tracker-session"

// The parsed session is cached against the exact string it came from. Without this,
// getSession() would return a brand new object on every call, and any `useEffect` that
// lists the session in its dependencies would re-run forever.
let cachedRaw: string | null = null
let cachedSession: Session | null = null

export function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function getSession(): Session | null {
  // Layouts and pages render on the server first, where there is no localStorage.
  if (typeof window === "undefined") return null

  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === cachedRaw) return cachedSession

  cachedRaw = stored
  cachedSession = parse(stored)
  return cachedSession
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
  cachedRaw = null
  cachedSession = null
}

function parse(stored: string | null): Session | null {
  if (!stored) return null

  try {
    return JSON.parse(stored) as Session
  } catch {
    // A half-written or hand-edited entry should sign the user out, not crash the app.
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}
