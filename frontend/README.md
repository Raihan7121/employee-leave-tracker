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

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Redirects to `/dashboard`. There is no public landing page. |
| `/login` | `app/login/page.tsx` | Email and password form. The only page that works without a session. |
| `/dashboard` | `app/dashboard/page.tsx` | Counts of the leave requests the current user can see. |
| `/dashboard/employees` | `app/dashboard/employees/page.tsx` | Admin only. Table of employees with add, edit and delete. |
| `/dashboard/leaves` | `app/dashboard/leaves/page.tsx` | Apply for leave, and — as an admin — approve or reject. |

`app/dashboard/layout.tsx` wraps every dashboard page with the nav bar and the sign-in
check, so a new page under `app/dashboard/` is protected by existing.

### How the route guard works

```
useSession()  →  loading?  →  render nothing (we don't know yet)
                 no session →  router.replace("/login")
                 session    →  render the nav bar and the page
```

Two details worth knowing:

- **It renders nothing while loading.** Redirecting on the very first render would throw
  out a perfectly good session, and rendering the dashboard would flash protected UI at a
  signed-out visitor.
- **This is not security.** The guard only hides UI. The token lives in `localStorage`,
  which the server cannot read, so the check has to run in the browser — and anything
  running in the browser can be bypassed. What actually protects the data is that the
  backend re-checks the token and the role on *every* request. Knowing a URL gets you
  nothing.

The nav only offers **Employees** to an admin, but that is a convenience, not a control:
an employee who navigates there anyway gets 403s from the API.

## The employees screen

A table of every employee, plus add, edit and delete. Remember that an employee row **is**
a login account, so creating one here creates a way to sign in.

**One dialog does both jobs.** `editing` holds the employee being changed, or `null` when
adding. The submit handler picks `POST /api/employees` or `PUT /api/employees/{id}` from
that single piece of state, instead of there being two nearly identical dialogs.

**The password field is blank when editing.** The backend reads a blank password as "keep
the current one", so an admin can correct a name or department without resetting somebody's
login. It is `required` only when adding.

**Reloading after a change.** Each successful save or delete bumps a `reloadKey` counter
that the load effect depends on, which re-runs the fetch. The alternative — patching the
local array by hand — would drift from what the server actually stored.

**Errors come from the backend.** Adding a duplicate email shows *"An employee with that
email already exists"*: that sentence is written once in `EmployeeService.java` and travels
through the problem-detail body into the dialog. The UI does not repeat the rule.

Deleting uses the browser's own `window.confirm` rather than a component, since it is a
single yes/no question.

## The leaves screen

One page serves both roles, because `GET /api/leaves` already returns everything to an
admin and only their own rows to an employee. The table needs no branch — **only the
buttons differ**:

| Row state | Employee sees | Admin sees |
|---|---|---|
| Their own, `PENDING` | Edit, Withdraw | Edit, Withdraw |
| Someone else's, `PENDING` | *(not in their list at all)* | Approve, Reject |
| Anything decided | nothing | nothing |

A decided request has no actions at all, which matches the backend: it answers 409 to any
attempt to change one. The UI is not enforcing that rule, only reflecting it.

**Dates use `<input type="date">`.** The browser supplies the calendar picker, the keyboard
handling and the `yyyy-mm-dd` string that the backend's `LocalDate` already expects — no
date library needed. The `min` attribute on the end date is a convenience; the real check
is `LeaveService.validateDates`, and its message is what the dialog displays.

**Dates are formatted from their parts.** `formatDate` splits `"2026-12-01"` and passes
year, month and day to `new Date(...)` separately, because `new Date("2026-12-01")` is
parsed as *UTC* midnight and would render as the previous day for anyone west of
Greenwich.

Status is shown as a `Badge`, always with its text label — the colour is a second signal,
never the only one.

### `useSession` and hydration

`hooks/use-session.ts` uses React's `useSyncExternalStore` rather than reading
`localStorage` in a `useEffect`. `localStorage` does not exist while Next.js prerenders on
the server, so the hook reports the server value first and swaps to the browser value
after hydration — no mismatched HTML, and no extra render pass.

`getSession()` caches its parsed result against the raw string it came from, so repeated
calls return the *same object*. Without that, every render would produce a new object and
any effect depending on the session would loop forever.

## Docker

Normally you would start this through the root `docker-compose.yml` alongside the backend.
On its own:

```bash
docker build --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 -t leave-frontend .
docker run -p 3000:3000 leave-frontend
```

The `Dockerfile` has three stages — `deps` installs from the lockfile, `build` compiles,
and `run` copies only Next.js's `standalone` output. `output: "standalone"` in
`next.config.ts` makes Next bundle the server together with just the dependencies it
actually imports, so the runtime image needs no `node_modules` and no source. It runs as a
non-root user.

### The one thing that is easy to get wrong

`NEXT_PUBLIC_API_URL` must be a **build argument**, and it must be the address as the
*browser* sees it:

- `NEXT_PUBLIC_*` values are substituted into the JavaScript bundle at build time. Setting
  one as a runtime `environment:` entry in compose has no effect — the value is already
  compiled in.
- The fetch runs in the browser, which is not on the Docker network. `http://backend:8080`
  resolves only between containers; from the browser it is a name that does not exist. It
  has to be `http://localhost:8080`, the published port on the host.

## Demo accounts

Seeded by the backend on every start:

| Email | Password | Role |
|---|---|---|
| `admin@mis.com` | `admin123` | ADMIN |
| `alice@mis.com` | `alice123` | EMPLOYEE |

They are also printed on the login page, so a reviewer never has to go looking.
