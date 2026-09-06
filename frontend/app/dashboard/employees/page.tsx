"use client"

import { useEffect, useState } from "react"

import { useSession } from "@/hooks/use-session"
import { apiFetch } from "@/lib/api"
import type { Employee, Role } from "@/lib/types"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface FormState {
  name: string
  email: string
  department: string
  role: Role
  password: string
}

const EMPTY_FORM: FormState = { name: "", email: "", department: "", role: "EMPLOYEE", password: "" }

/**
 * Admin-only screen for managing employee records. One dialog serves both creating and
 * editing: `editing` holds the employee being changed, or null when adding a new one.
 */
export default function EmployeesPage() {
  const { session } = useSession()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Bumped after every change to re-run the load effect.
  const [reloadKey, setReloadKey] = useState(0)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  const isAdmin = session?.role === "ADMIN"

  useEffect(() => {
    if (!session || !isAdmin) return

    let cancelled = false

    async function load() {
      try {
        const list = await apiFetch<Employee[]>("/api/employees")
        if (!cancelled) setEmployees(list)
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load employees")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [session, isAdmin, reloadKey])

  // The nav hides this page from employees, but the URL can still be typed in.
  if (session && !isAdmin) {
    return <p className="text-sm text-muted-foreground">Only an admin can manage employees.</p>
  }

  function openAddDialog() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError("")
    setDialogOpen(true)
  }

  function openEditDialog(employee: Employee) {
    setEditing(employee)
    setForm({
      name: employee.name,
      email: employee.email,
      department: employee.department ?? "",
      role: employee.role,
      // Left blank on purpose: the backend reads a blank password as "keep the current one".
      password: "",
    })
    setFormError("")
    setDialogOpen(true)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError("")
    setSaving(true)

    try {
      await apiFetch<Employee>(editing ? `/api/employees/${editing.id}` : "/api/employees", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(form),
      })
      setDialogOpen(false)
      setReloadKey((key) => key + 1)
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save the employee")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(employee: Employee) {
    // ponytail: the browser's own confirm dialog, rather than pulling in an alert-dialog
    // component for a single yes/no question.
    if (!window.confirm(`Delete ${employee.name}? Their leave requests will go too.`)) return

    setError("")
    try {
      await apiFetch<void>(`/api/employees/${employee.id}`, { method: "DELETE" })
      setReloadKey((key) => key + 1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the employee")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">Employees</h1>
          <p className="text-sm text-muted-foreground">Each employee row is also their login account.</p>
        </div>
        <Button onClick={openAddDialog}>Add employee</Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="font-medium">{employee.name}</TableCell>
                <TableCell>{employee.email}</TableCell>
                <TableCell>{employee.department ?? "—"}</TableCell>
                <TableCell>{employee.role === "ADMIN" ? "Admin" : "Employee"}</TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(employee)}>
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(employee)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit employee" : "Add employee"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Leave the password blank to keep the current one."
                : "The email and password become their login."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="employee-email">Email</Label>
              <Input
                id="employee-email"
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={form.department}
                onChange={(event) => setForm({ ...form, department: event.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">Role</Label>
              <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value as Role })}>
                <SelectTrigger id="role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="employee-password">Password</Label>
              <Input
                id="employee-password"
                type="password"
                autoComplete="new-password"
                required={!editing}
                placeholder={editing ? "Unchanged" : ""}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
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
