# Leave Tracker — Backend

REST API for the Employee Leave Tracker. It stores employees and their leave requests,
and lets an admin approve or reject those requests.

## Tech stack

| Piece | Choice | Why |
|---|---|---|
| Language | Java 21 | Toolchain pinned in `build.gradle`. |
| Framework | Spring Boot 4.1.1 (Web MVC) | Batteries-included REST + security + persistence. |
| Persistence | Spring Data JPA + Hibernate | Repository interfaces instead of hand-written SQL. |
| Database | H2, in-memory | No install, no volume, no container. Resets on every restart. |
| Security | Spring Security + OAuth2 Resource Server | BCrypt password hashing, JWT bearer tokens. |
| Docs | springdoc-openapi | Swagger UI at `/swagger-ui.html`. |
| Build | Gradle wrapper | `./gradlew` — no local Gradle install needed. |

## Running it

```bash
./gradlew bootRun          # http://localhost:8080
./gradlew test             # run the tests
```

The database is thrown away when the process stops. `DataSeeder` refills it on the next
start, so the app always has data to show.

## Data model

Two tables. An **employee is also the login account** — the email and password used to
sign in live on the employee row, and `role` decides what that account may do. A separate
`user` table would have been 1:1 with this one, so it was not worth the join.

```
employees                              leaves
---------                              ------
id           BIGINT  PK                id           BIGINT  PK
name         VARCHAR                   employee_id  BIGINT  FK -> employees.id
email        VARCHAR UNIQUE            start_date   DATE
department   VARCHAR                   end_date     DATE
password     VARCHAR  (BCrypt hash)    reason       VARCHAR
role         ENUM(ADMIN, EMPLOYEE)     status       ENUM(PENDING, APPROVED, REJECTED)
```

A leave request is created as `PENDING`. An admin moves it to `APPROVED` or `REJECTED`,
and those are final.

The `password` column holds a BCrypt hash, never plain text. On the entity it is annotated
`@JsonProperty(access = WRITE_ONLY)`, so Jackson will accept a password on the way *in*
but will never include one on the way *out*.

The table is called `leaves` rather than `leave` because `LEAVE` is a reserved SQL word.

## Seeded accounts

| Email | Password | Role |
|---|---|---|
| `admin@mis.com` | `admin123` | ADMIN |
| `alice@mis.com` | `alice123` | EMPLOYEE |
| `bob@mis.com` | `bob123` | EMPLOYEE |
| `carol@mis.com` | `carol123` | EMPLOYEE |

Plus four leave requests across the three employees in mixed statuses.

## Authentication

The API is stateless: there is no session and no cookie. A client logs in once, gets a
signed token, and attaches it to every later request.

```
POST /api/auth/login  {"email": "...", "password": "..."}
  -> AuthService looks up the employee by email
  -> BCrypt checks the submitted password against the stored hash
  -> a JWT is signed and returned with the employee's id, name and role

GET /api/auth/me      Authorization: Bearer <token>
  -> Spring Security verifies the signature and expiry before the controller runs
  -> AuthService loads the employee whose id is the token's subject
```

### Endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | public | Exchange email + password for a token. |
| GET | `/api/auth/me` | any signed-in user | The account behind the current token. |

### What is inside the token

```json
{ "iss": "leave-tracker", "sub": "1", "name": "Admin User",
  "roles": ["ADMIN"], "iat": 1788687381, "exp": 1788716181 }
```

`sub` is the employee id — that is how every other endpoint knows who is calling.
`roles` is what `@PreAuthorize("hasRole('ADMIN')")` reads. Tokens are signed with
HMAC-SHA256 using the shared secret in `app.jwt.secret` (override with the `JWT_SECRET`
environment variable) and expire after 8 hours.

### Why there is no custom auth filter

`SecurityConfig` declares the API as an **OAuth2 resource server**. That single line
makes Spring Security add its own filter that reads the `Authorization` header, verifies
the token with the configured `JwtDecoder`, and fills in the security context. The only
thing this project writes by hand is the *issuing* side in `AuthService`. A
`JwtAuthenticationConverter` maps our `roles` claim onto the `ROLE_`-prefixed authorities
that `hasRole(...)` expects.

CSRF protection is off because there is nothing to protect: with no cookies, a request
can only carry a token if our own JavaScript put it there.

### Trying it out

```bash
TOKEN=$(curl -s -X POST localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@mis.com","password":"admin123"}' | jq -r .token)

curl localhost:8080/api/auth/me -H "Authorization: Bearer $TOKEN"
```

## Employees

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/employees` | any signed-in user | List everyone. |
| GET | `/api/employees/{id}` | any signed-in user | One employee. |
| POST | `/api/employees` | ADMIN | Create an employee (and their login). |
| PUT | `/api/employees/{id}` | ADMIN | Update name, email, department, role, password. |
| DELETE | `/api/employees/{id}` | ADMIN | Remove an employee and their leave requests. |

Reads are open to any signed-in user because the leave screens need employee names.
Writes carry `@PreAuthorize("hasRole('ADMIN')")`, which reads the `roles` claim out of the
token — an employee calling `POST /api/employees` gets a 403.

Rules that live in `EmployeeService`:

- The submitted password is hashed with BCrypt before it is stored, on both create and update.
- On update, a **blank password means "leave the current one alone"** so an admin can fix a
  typo in a name without resetting somebody's login.
- A duplicate email returns **409** rather than letting the unique constraint blow up as a 500.
- A missing name, email or password returns **400**.
- Deleting an employee removes their leave requests first, in the same transaction — the
  `leaves.employee_id` foreign key is non-null, so the database would otherwise refuse.

## Leave requests

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/leaves` | any signed-in user | Admin sees every request, an employee sees only their own. |
| GET | `/api/leaves/{id}` | owner or ADMIN | One request. |
| POST | `/api/leaves` | any signed-in user | Apply for leave. |
| PUT | `/api/leaves/{id}` | owner, while PENDING | Change the dates or reason. |
| DELETE | `/api/leaves/{id}` | owner, while PENDING | Withdraw the request. |
| PATCH | `/api/leaves/{id}/status` | ADMIN | Approve or reject: `{"status":"APPROVED"}`. |

### Status lifecycle

```
          POST /api/leaves
                 │
                 ▼
             PENDING ──── PATCH /status (admin) ──┬──> APPROVED
          editable by                             └──> REJECTED
          its owner                                    final — no further edits
```

### Rules enforced in `LeaveService`

- **Owner and status are never taken from the request body.** A new request is always
  filed for whoever sent the token, and always starts as `PENDING`. Posting
  `{"status":"APPROVED","employee":{"id":1}}` is silently ignored — you cannot self-approve
  or apply on somebody else's behalf.
- **Employees are scoped to their own rows.** `GET /api/leaves` runs a different query
  depending on the caller's role, so an employee never receives data they should not see.
  Fetching another person's request by id gives 403.
- **Only PENDING requests can be edited or withdrawn**, and only by their owner. Touching
  a decided request gives 409.
- **A decision is final.** Approving an already-decided request gives 409, and any status
  other than `APPROVED` or `REJECTED` gives 400.
- `endDate` before `startDate` gives 400.

Approving is the one thing an employee can never do: `PATCH /{id}/status` carries
`@PreAuthorize("hasRole('ADMIN')")`, so Spring Security rejects the call before the method
body runs.

## Package layout

```
com.millennium.leave_tracker
├── domain/       JPA entities and enums — the shape of the data
├── repository/   Spring Data interfaces — the database access
├── dto/          Small records for request/response shapes that are not entities
├── config/       Security beans and the startup data seeder
├── service/      Business rules — controllers stay thin, this is where decisions happen
└── controller/   HTTP endpoints — map a URL to a service call and nothing more
```

A request travels **controller → service → repository → database** and the response comes
back the same way.

## Inspecting the database

With the app running, open <http://localhost:8080/h2-console> and connect with:

- JDBC URL: `jdbc:h2:mem:leavedb`
- User: `sa`, no password

The API docs are at <http://localhost:8080/swagger-ui.html>. Both are left open in
`SecurityConfig` because this is a development build.
