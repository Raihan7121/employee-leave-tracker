import { clearSession, getSession } from "@/lib/auth"

/**
 * The single place this app talks to the backend.
 *
 * Every screen calls `apiFetch` instead of `fetch`, so attaching the token, decoding
 * errors and handling an expired session are written once rather than in every component.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

const LOGIN_PATH = "/api/auth/login"

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getSession()

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      // This header is what Spring Security's resource server filter looks for.
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...options.headers,
    },
  })

  // An expired or invalid token means the stored session is useless. The login page is
  // excluded because there a 401 just means "wrong password", which the form displays.
  if (response.status === 401 && path !== LOGIN_PATH) {
    clearSession()
    window.location.href = "/login"
    throw new Error("Your session has expired. Please sign in again.")
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  // 204 No Content (a successful DELETE) has an empty body, so there is nothing to parse.
  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

/**
 * The backend returns RFC 9457 problem details, e.g.
 * `{"title":"Conflict","status":409,"detail":"Leave 3 was already APPROVED"}`.
 * `detail` is the sentence written in the Java service, so it is the one worth showing.
 *
 * Spring Security answers a blocked `@PreAuthorize` call with a bare 403 and no body, so
 * the fallbacks matter.
 */
async function readErrorMessage(response: Response): Promise<string> {
  if (response.status === 403) {
    return "You are not allowed to do that."
  }

  try {
    const body = await response.json()
    return body.detail || body.title || `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}
