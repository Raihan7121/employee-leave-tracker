/**
 * The shapes the backend sends back. These mirror the Java entities in
 * `backend/src/main/java/com/millennium/leave_tracker/domain/`.
 */

export type Role = "ADMIN" | "EMPLOYEE"

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED"

export interface Employee {
  id: number
  name: string
  email: string
  department: string | null
  role: Role
  /** Only ever sent to the server, never returned by it. */
  password?: string
}

export interface Leave {
  id: number
  employee: Employee
  /** ISO dates, e.g. "2026-12-01" — the format `<input type="date">` uses. */
  startDate: string
  endDate: string
  reason: string | null
  status: LeaveStatus
}

/** What `POST /api/auth/login` returns, and what we keep in localStorage. */
export interface Session {
  token: string
  id: number
  name: string
  email: string
  role: Role
}
