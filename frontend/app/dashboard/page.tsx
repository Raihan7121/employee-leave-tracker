"use client"

import { useEffect, useState } from "react"

import { useSession } from "@/hooks/use-session"
import { apiFetch } from "@/lib/api"
import type { Employee, Leave } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Landing page after signing in: a short summary of the leave requests the current user is
 * allowed to see. `GET /api/leaves` already returns everything for an admin and only their
 * own rows for an employee, so the same call serves both without a branch here.
 */
export default function OverviewPage() {
  const { session } = useSession()
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [employeeCount, setEmployeeCount] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  const isAdmin = session?.role === "ADMIN"

  useEffect(() => {
    // The layout has already redirected if there is no session; wait for it so the request
    // goes out with a token attached.
    if (!session) return

    // If the user navigates away mid-request, the response must not update a component
    // that is no longer on screen.
    let cancelled = false

    async function load() {
      try {
        const allLeaves = await apiFetch<Leave[]>("/api/leaves")
        if (cancelled) return
        setLeaves(allLeaves)

        if (isAdmin) {
          const employees = await apiFetch<Employee[]>("/api/employees")
          if (cancelled) return
          setEmployeeCount(employees.length)
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load the dashboard")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [session, isAdmin])

  const tiles = [
    { label: isAdmin ? "All requests" : "My requests", value: leaves.length },
    { label: "Pending", value: leaves.filter((leave) => leave.status === "PENDING").length },
    { label: "Approved", value: leaves.filter((leave) => leave.status === "APPROVED").length },
    ...(isAdmin && employeeCount !== null ? [{ label: "Employees", value: employeeCount }] : []),
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-medium">Welcome back, {session?.name}</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "You can manage employees and decide on every leave request."
            : "You can apply for leave and track your own requests."}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => (
            <Card key={tile.label}>
              <CardHeader>
                <CardTitle className="text-sm font-normal text-muted-foreground">{tile.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-medium tabular-nums">{tile.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
