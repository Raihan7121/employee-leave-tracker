"use client"

import { useEffect, useState } from "react"

import { useSession } from "@/hooks/use-session"
import { apiFetch } from "@/lib/api"
import type { Leave, LeaveStatus } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface FormState {
  startDate: string
  endDate: string
  reason: string
}

const EMPTY_FORM: FormState = { startDate: "", endDate: "", reason: "" }

const STATUS_VARIANT: Record<LeaveStatus, "secondary" | "default" | "destructive"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
}

/**
 * The leave screen, shared by both roles. `GET /api/leaves` already returns everything for
 * an admin and only their own rows for an employee, so the table itself needs no branch -
 * only the action buttons differ.
 */
export default function LeavesPage() {
  const { session } = useSession()
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Leave | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  const isAdmin = session?.role === "ADMIN"

  useEffect(() => {
    if (!session) return

    let cancelled = false

    async function load() {
      try {
        const list = await apiFetch<Leave[]>("/api/leaves")
        if (!cancelled) setLeaves(list)
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load leave requests")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [session, reloadKey])

  function openApplyDialog() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError("")
    setDialogOpen(true)
  }

  function openEditDialog(leave: Leave) {
    setEditing(leave)
    setForm({ startDate: leave.startDate, endDate: leave.endDate, reason: leave.reason ?? "" })
    setFormError("")
    setDialogOpen(true)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError("")
    setSaving(true)

    try {
      await apiFetch<Leave>(editing ? `/api/leaves/${editing.id}` : "/api/leaves", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(form),
      })
      setDialogOpen(false)
      setReloadKey((key) => key + 1)
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save the request")
    } finally {
      setSaving(false)
    }
  }

  /** Approve or reject. Only an admin gets these buttons, and only the API can enforce that. */
  async function handleDecision(leave: Leave, status: LeaveStatus) {
    setError("")
    try {
      await apiFetch<Leave>(`/api/leaves/${leave.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      setReloadKey((key) => key + 1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the request")
    }
  }

  async function handleWithdraw(leave: Leave) {
    // ponytail: the browser's own confirm, rather than an alert-dialog component for one
    // yes/no question.
    if (!window.confirm("Withdraw this leave request?")) return

    setError("")
    try {
      await apiFetch<void>(`/api/leaves/${leave.id}`, { method: "DELETE" })
      setReloadKey((key) => key + 1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not withdraw the request")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">Leave requests</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Every request, with your decision on the pending ones." : "The requests you have filed."}
          </p>
        </div>
        <Button onClick={openApplyDialog}>Apply for leave</Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : leaves.length === 0 ? (
        <p className="text-sm text-muted-foreground">No leave requests yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Employee</TableHead>}
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaves.map((leave) => {
              const isOwner = leave.employee.id === session?.id
              const isPending = leave.status === "PENDING"

              return (
                <TableRow key={leave.id}>
                  {isAdmin && <TableCell className="font-medium">{leave.employee.name}</TableCell>}
                  <TableCell>{formatDate(leave.startDate)}</TableCell>
                  <TableCell>{formatDate(leave.endDate)}</TableCell>
                  <TableCell className="text-muted-foreground">{leave.reason || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[leave.status]}>{leave.status}</Badge>
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    {/* A decided request is final, so it has no actions at all. */}
                    {isPending && isAdmin && (
                      <>
                        <Button size="sm" onClick={() => handleDecision(leave, "APPROVED")}>
                          Approve
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDecision(leave, "REJECTED")}>
                          Reject
                        </Button>
                      </>
                    )}
                    {isPending && isOwner && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(leave)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleWithdraw(leave)}>
                          Withdraw
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit leave request" : "Apply for leave"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "You can change a request while it is still pending."
                : "The request is filed for you and starts as pending."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startDate">From</Label>
              {/* Native date input: the browser supplies the picker and the yyyy-mm-dd
                  format the backend's LocalDate already expects. */}
              <Input
                id="startDate"
                type="date"
                required
                value={form.startDate}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endDate">To</Label>
              <Input
                id="endDate"
                type="date"
                required
                // The backend checks this too; the attribute just catches it sooner.
                min={form.startDate || undefined}
                value={form.endDate}
                onChange={(event) => setForm({ ...form, endDate: event.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
              />
            </div>

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Formats "2026-12-01" for display. The parts are passed to the Date constructor
 * individually on purpose: `new Date("2026-12-01")` is parsed as UTC midnight, which
 * displays as the previous day for anyone west of Greenwich.
 */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}
