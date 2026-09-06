"use client"

import { useSyncExternalStore } from "react"

import { getSession } from "@/lib/auth"
import type { Session } from "@/lib/types"

/**
 * The signed-in user, or `null` once we know there isn't one.
 *
 * `localStorage` does not exist while Next.js prerenders on the server, and reading it
 * during the first browser render would make the two produce different HTML - a hydration
 * mismatch. `useSyncExternalStore` is React's answer to exactly this: it returns the
 * server value first, then swaps to the browser value, with no effect and no extra render
 * pass of our own.
 *
 * `loading` is true for that first render only. Callers wait for it before deciding
 * anything - a guard that redirected too early would throw out a perfectly good session.
 */
export function useSession(): { session: Session | null; loading: boolean } {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)

  return {
    session: hydrated ? getSession() : null,
    loading: !hydrated,
  }
}

// The stored session only changes through saveSession/clearSession, both of which are
// followed by a navigation, so there is nothing to subscribe to. React still requires the
// argument, and it must be a stable reference.
const subscribe = () => () => {}
