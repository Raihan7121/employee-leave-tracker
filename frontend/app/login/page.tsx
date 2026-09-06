"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { apiFetch } from "@/lib/api"
import { saveSession } from "@/lib/auth"
import type { Session } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * Exchanges an email and password for a token, stores it, and moves on to the dashboard.
 * This is the only page that works without a session.
 */
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSubmitting(true)

    try {
      const session = await apiFetch<Session>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
      saveSession(session)
      router.push("/dashboard")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Leave Tracker</CardTitle>
          <CardDescription>Sign in to manage employees and leave requests.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 border-t pt-4 text-xs text-muted-foreground">
            <p className="mb-1 font-medium">Demo accounts</p>
            <p>Admin — admin@mis.com / admin123</p>
            <p>Employee — alice@mis.com / alice123</p>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
