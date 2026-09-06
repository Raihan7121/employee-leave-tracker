# Leave Tracker — Frontend

The web UI for the Employee Leave Tracker. It signs a user in, then talks to the Spring
Boot API over REST with a JWT.

## Tech stack

| Piece | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | File-system routing, one build for dev and production. |
| Language | TypeScript | The API's shapes are described once in `lib/types.ts`. |
| UI | React 19 + shadcn/ui (base-ui) | Components are copied into `components/ui/`, so they are ours to read and edit. |
| Styling | Tailwind CSS v4 | Utility classes, no separate stylesheet to keep in sync. |
| Package manager | pnpm | Lockfile is committed. |

## Running it

The backend must be running first (see `../backend/README.md`).

```bash
pnpm install
cp .env.example .env.local     # points at http://localhost:8080
pnpm dev                       # http://localhost:3000
```

Other scripts: `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`.

### Environment

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the backend, e.g. `http://localhost:8080`. |

The `NEXT_PUBLIC_` prefix means the value is readable in the browser — which it has to be,
because **the browser** calls the API directly, not the Next.js server. That also means the
value is baked in at build time, not read at startup.

## How the frontend talks to the backend

Everything is a **client component** (`"use client"`). The token lives in `localStorage`,
which only the browser can read, so there is no server-side data fetching to mix in. The
data flow is the same as any single-page app: the browser renders, then fetches.

```
  <form> submit
       │
       ▼
  apiFetch("/api/auth/login", …)      lib/api.ts
       │  attaches no token (there isn't one yet)
       ▼
  POST http://localhost:8080/api/auth/login
       │  200 {token, id, name, email, role}
       ▼
  saveSession(...)                     lib/auth.ts  → localStorage
       │
       ▼
  router.push("/dashboard")

  …every later request:
  apiFetch("/api/leaves")
       │  reads the session and adds  Authorization: Bearer <token>
       ▼
  Spring Security verifies the token before the controller runs
```

### The three files that matter

| File | Job |
|---|---|
| `lib/types.ts` | TypeScript mirrors of the backend's `Employee`, `Leave` and login response. |
| `lib/auth.ts` | Read, write and clear the session in `localStorage`. |
| `lib/api.ts` | The **only** place that calls `fetch`. Adds the base URL and the token, unwraps errors, and signs the user out on a 401. |

Every screen calls `apiFetch` rather than `fetch`, so the token header, error decoding and
expired-session handling are written once instead of in every component.

**Errors.** The backend returns RFC 9457 problem details
(`{"title":"Conflict","status":409,"detail":"Leave 3 was already APPROVED"}`), so
`apiFetch` can surface the exact sentence written in the Java service. A 403 from Spring
Security has no body, so that case gets a fixed message.

**Expired tokens.** A 401 on any request except login means the stored token is no longer
good: `apiFetch` clears the session and sends the browser back to `/login`.

### Where the token is kept, and why

In `localStorage`. That is readable by any JavaScript on the page, so a cross-site
scripting bug would leak it. An httpOnly cookie would not have that weakness, but it
cannot be read from JavaScript at all, which would mean proxying every API call through a
Next.js route handler plus cookie configuration on the Spring side. For an assessment app
the simpler option that can be explained end to end is the better trade — the weakness is
stated rather than hidden.

## Routes

| Route | Purpose |
|---|---|
| `/login` | Email and password form. The only page that works without a session. |

## Demo accounts

Seeded by the backend on every start:

| Email | Password | Role |
|---|---|---|
| `admin@mis.com` | `admin123` | ADMIN |
| `alice@mis.com` | `alice123` | EMPLOYEE |

They are also printed on the login page, so a reviewer never has to go looking.
