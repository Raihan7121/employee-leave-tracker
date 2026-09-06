"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { useSession } from "@/hooks/use-session"
import { clearSession } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * Wraps every dashboard page with the navigation bar and the sign-in check.
 *
 * The guard runs in the browser, which is the honest place for it: the token lives in
 * localStorage, so the server has no way to know whether a visitor is signed in. This
 * only hides UI - it is not what keeps data safe. Every request is checked again by the
 * backend, so knowing a URL gets you nothing without a valid token.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { session, loading } = useSession()

  useEffect(() => {
    if (!loading && !session) {
      // `replace` rather than `push` so the back button does not return to a page the
      // visitor cannot see.
      router.replace("/login")
    }
  }, [loading, session, router])

  // Render nothing until we know who the visitor is, otherwise a signed-out user would
  // see the dashboard flash on screen before the redirect happens.
  if (loading || !session) {
    return null
  }

  const links = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/leaves", label: "Leaves" },
    // Only an admin can manage employees, so only an admin is offered the link. The
    // backend rejects the calls regardless.
    ...(session.role === "ADMIN" ? [{ href: "/dashboard/employees", label: "Employees" }] : []),
  ]

  function handleSignOut() {
    clearSession()
    router.replace("/login")
  }

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <span className="font-medium">Leave Tracker</span>

          <nav className="flex gap-4 text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "transition-colors hover:text-foreground",
                  pathname === link.href ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {session.name} · {session.role === "ADMIN" ? "Admin" : "Employee"}
            </span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}
