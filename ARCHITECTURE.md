# Architecture and Inner Workings

The written explanation required by the assessment: how the frontend and backend interact,
what the key components do, how the API works internally, and how the Docker setup fits
together.

For setup and demo credentials see [README.md](README.md).

---

## 1. The shape of the system

Three moving parts, and it matters which is which:

| Part | Runs where | Responsibility |
|---|---|---|
| **Next.js frontend** | Container on `:3000` | Serves the HTML and JavaScript. |
| **React app** | The visitor's **browser** | Renders every screen and makes every API call. |
| **Spring Boot backend** | Container on `:8080` | Owns the data and every rule about it. |

The distinction between the second and third rows is the single most important fact about
this app. The frontend container hands the browser a bundle and then plays no further part.
**All data flows between the browser and the backend directly.** The two containers never
speak to each other.

```
        ┌──────────────────────────── the browser ────────────────────────────┐
        │                                                                     │
        │   1. GET /dashboard/leaves                                          │
        │   ───────────────────────────────▶  frontend container :3000        │
        │   ◀───────────────────────────────  HTML + JS bundle                │
        │                                                                     │
        │   2. React runs, reads the token from localStorage                  │
        │                                                                     │
        │   3. GET /api/leaves  +  Authorization: Bearer <jwt>                │
        │   ───────────────────────────────▶  backend container :8080         │
        │   ◀───────────────────────────────  JSON                            │
        │                                                                     │
        └─────────────────────────────────────────────────────────────────────┘
```

This is why `NEXT_PUBLIC_API_URL` is `http://localhost:8080` and not `http://backend:8080`.
`backend` is a name on the Docker network; the browser is not on that network and cannot
resolve it. The URL has to be the one published to the host.

### Why the frontend is entirely client-side

Next.js can render on the server, and this app deliberately does not. The reason is the
token: it lives in `localStorage`, which exists only in the browser. A server component
cannot read it, so it could not make an authorised call. Server rendering would require
moving the token into a cookie and proxying every API call through Next.js — a second
backend in front of the real one.

Every page is therefore marked `"use client"` and fetches its own data, exactly like any
single-page app. The trade-off is stated rather than hidden: it is simpler, it is fully
explainable, and it costs a brief loading state on each screen.

---

## 2. Key components

### Backend — `backend/src/main/java/com/millennium/leave_tracker/`

```
domain/       Employee, Leave, Role, LeaveStatus     the shape of the data
repository/   EmployeeRepository, LeaveRepository    database access
dto/          LoginRequest/Response, StatusUpdate    request shapes that aren't entities
config/       SecurityConfig, DataSeeder             security wiring and startup data
service/      AuthService, EmployeeService,          the rules
              LeaveService
controller/   AuthController, EmployeeController,    URL → service call
              LeaveController
```

A request travels **controller → service → repository → database** and the response returns
the same way. The layers each have one job:

- **Controllers** map an HTTP verb and path to a method call, and nothing else. They hold no
  `if` statements about permissions or validity. `LeaveController` is the clearest example:
  every method resolves the caller from the token and hands straight off to the service.
- **Services** hold every rule. If you want to know what the app *does*, `LeaveService` is
  the file to read.
- **Repositories** are interfaces with no implementation. Spring Data writes the SQL at
  startup by reading the method names — `findByEmployeeId` becomes
  `SELECT … WHERE employee_id = ?`.
- **Entities** are the tables. `@Entity` maps a class to a table, and Hibernate creates the
  schema from them on boot.

**Two entities, and one of them does double duty.** An `Employee` row *is* a login account:
the email and password used to sign in are columns on it, and `role` decides what the
account may do. A separate `users` table would have been one-to-one with `employees` for
the whole life of the app, so it would have bought a join and nothing else.

The password column stores a BCrypt hash, never plain text, and is annotated
`@JsonProperty(access = WRITE_ONLY)` — Jackson will read a password from an incoming
request but will never write one into a response.

### Frontend — `frontend/`

```
app/login/page.tsx              email + password → token
app/page.tsx                    redirects to /dashboard
app/dashboard/layout.tsx        nav bar + the signed-in check, wraps every dashboard page
app/dashboard/page.tsx          summary counts
app/dashboard/employees/page.tsx  admin: employee CRUD
app/dashboard/leaves/page.tsx     apply for leave; admin: approve / reject
lib/api.ts                      the only place that calls fetch()
lib/auth.ts                     session in localStorage
lib/types.ts                    TypeScript mirrors of the backend entities
hooks/use-session.ts            the current user, hydration-safe
components/ui/                  shadcn components, copied in and owned by us
```

Three files carry the weight:

- **`lib/api.ts`** — every screen calls `apiFetch` instead of `fetch`. Attaching the token,
  prefixing the base URL, decoding the error body and signing out on a `401` are written
  once here rather than repeated in each component.
- **`lib/auth.ts`** — reads and writes the session. `getSession()` caches its parsed result
  against the raw string it came from, so repeated calls return the *same object*. Without
  that, every render would produce a new object and any effect depending on the session
  would re-run forever.
- **`app/dashboard/layout.tsx`** — the nav bar and the guard. A new page under
  `app/dashboard/` is protected simply by existing there.

---

## 3. How the API works internally

### Signing in

```
POST /api/auth/login  {"email":"admin@mis.com","password":"admin123"}
   │
   ├─▶ SecurityConfig has this one path marked permitAll, so no token is required
   │
   ├─▶ AuthController.login → AuthService.login
   │      EmployeeRepository.findByEmail("admin@mis.com")
   │      passwordEncoder.matches("admin123", storedHash)   ← BCrypt
   │
   └─▶ signs a JWT and returns it
```

A missing account and a wrong password produce the *same* 401 on purpose: otherwise the
response would reveal which email addresses are registered.

The token is signed with HMAC-SHA256 and carries:

```json
{ "iss": "leave-tracker", "sub": "1", "name": "Admin User",
  "roles": ["ADMIN"], "iat": 1788687381, "exp": 1788716181 }
```

`sub` is the employee id — this is how every later request knows who is calling. `roles` is
what the authorisation checks read. A JWT is signed, not encrypted: anyone can read those
claims, but changing one invalidates the signature, so the server will reject it. Nothing
secret goes inside.

### Every other request

```
GET /api/leaves     Authorization: Bearer eyJhbGciOiJIUzI1NiJ9…
   │
   ├─▶ Spring Security's resource-server filter
   │      verifies the signature with the shared secret
   │      checks it has not expired
   │      reads the "roles" claim → authority ROLE_ADMIN
   │      → rejects with 401 before any of our code runs if any of that fails
   │
   ├─▶ @PreAuthorize("hasRole('ADMIN')") on admin-only methods → 403 if it does not hold
   │
   ├─▶ LeaveController.list(jwt)
   │      AuthService.currentEmployee(jwt)   ← token subject → Employee
   │      LeaveService.findAllFor(caller)
   │         admin    → leaveRepository.findAll()
   │         employee → leaveRepository.findByEmployeeId(caller.id)
   │
   └─▶ Jackson serialises the result to JSON (skipping the password field)
```

**There is no hand-written authentication filter.** `SecurityConfig` declares the API as an
OAuth2 *resource server*, which is Spring Security's built-in support for exactly this:
bearer tokens verified on the way in. Our code only has to *issue* tokens, in `AuthService`.
A `JwtAuthenticationConverter` maps the `roles` claim onto the `ROLE_`-prefixed authorities
that `hasRole(...)` expects.

CSRF protection is disabled because there is nothing for it to protect. CSRF attacks work
by making a browser send a cookie it already holds; this API uses no cookies and no session,
so a request can only carry a token if our own JavaScript put it there.

### The rules that actually matter

All in `LeaveService`, and all enforced on the server:

1. **Listing is scoped by role.** An employee's query is filtered by their own id, so they
   never receive rows they should not see. Filtering in the UI would mean the data had
   already been sent.
2. **Owner and status are never taken from the request body.** A new request is always filed
   for whoever sent the token and always starts `PENDING`. Posting
   `{"status":"APPROVED","employee":{"id":1}}` is silently ignored — you cannot self-approve
   or apply on someone else's behalf. There is a test for exactly this.
3. **Only `PENDING` requests can be edited or withdrawn, and only by their owner.**
4. **A decision is final.** Deciding an already-decided request returns 409.
5. **Only an admin decides.** `@PreAuthorize` blocks the call before the method body runs.

The frontend mirrors all of this — a decided row simply has no buttons — but that is
presentation. Deleting the buttons in devtools changes nothing.

### Errors

The backend returns RFC 9457 problem details:

```json
{ "title": "Conflict", "status": 409,
  "detail": "Leave 3 was already APPROVED", "instance": "/api/leaves/3/status" }
```

`detail` is the sentence written once in the Java service. `apiFetch` pulls it out and the
dialog displays it, so a rule is stated in exactly one place in the whole system. (Spring
Security answers a blocked `@PreAuthorize` with a bodyless 403, so that one case has a fixed
message on the client.)

---

## 4. Docker setup

```
docker-compose.yml
├── backend    build: ./backend    → :8080   healthcheck on /v3/api-docs
└── frontend   build: ./frontend   → :3000   depends_on: backend (service_healthy)
```

Both images are **multi-stage**, which matters for the same reason in both cases: the tools
needed to *build* an app are not needed to *run* it, and shipping them enlarges the image
and its attack surface.

**`backend/Dockerfile`** — a JDK stage runs `./gradlew bootJar`; the runtime stage starts
from a JRE-only image and copies in just the jar. The Gradle wrapper downloads the exact
Gradle version the project expects, so nothing has to be preinstalled. The final image has
no source, no Gradle and no compiler.

**`frontend/Dockerfile`** — `deps` installs from the lockfile alone (so the layer is reused
whenever source changes but dependencies do not), `build` compiles, and `run` copies only
Next.js's `standalone` output. `output: "standalone"` bundles the server together with just
the dependencies actually imported, so the runtime image needs no `node_modules` at all.

Both run as a non-root user.

**`depends_on` uses `condition: service_healthy`**, not the bare form. Plain `depends_on`
waits only for the container to exist, which for a Spring Boot app is several seconds before
it can answer anything.

**No volumes.** The database is in-memory, so there is no state to persist — and the reseed
on every start is a feature here: the demo is never empty and never in a strange state.

### The build-time / run-time trap

```yaml
frontend:
  build:
    args:
      NEXT_PUBLIC_API_URL: http://localhost:8080   # correct
```

Two things are easy to get wrong at once:

1. **It must be a build arg, not an `environment:` entry.** Next.js substitutes
   `NEXT_PUBLIC_*` values into the JavaScript bundle when it compiles. Setting one at
   runtime has no effect — the value is already baked in.
2. **It must be the host address.** The fetch runs in the browser, which is not on the
   Docker network, so `http://backend:8080` would not resolve.

`JWT_SECRET`, by contrast, *is* a runtime environment variable: it is read by the Java
process when it starts, and it overrides the development key in `application.properties`.

---

## 5. What I would change for production

Honest list, roughly in order of importance:

1. **A real database.** Swap the H2 datasource for PostgreSQL as a third service. The JPA
   code does not change — that is the point of the repository layer.
2. **Move the token out of `localStorage`** into an httpOnly cookie, so a cross-site
   scripting bug cannot read it. This needs a proxy route in Next.js and cookie config in
   Spring Security.
3. **`JWT_SECRET` from a real secret store**, not a value committed in a compose file, and
   `spring.jpa.hibernate.ddl-auto=validate` with migrations instead of `update`.
4. **Refresh tokens.** Right now an 8-hour token simply expires and the user signs in again.
5. **Close the H2 console and Swagger UI**, both currently open for convenience.
6. **Bean Validation** (`@NotBlank`, `@Email`) instead of the hand-written checks in the
   services, once there are enough fields for it to pay for itself.
