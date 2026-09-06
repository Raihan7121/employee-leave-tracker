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

export function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function getSession(): Session | null {
  // Layouts and pages render on the server first, where there is no localStorage.
  if (typeof window === "undefined") return null

  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return null

  try {
    return JSON.parse(stored) as Session
  } catch {
    // A half-written or hand-edited entry should log the user out, not crash the app.
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}
