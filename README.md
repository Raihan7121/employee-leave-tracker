# Employee Leave Tracker

A small full-stack web app for tracking employee leave. Employees apply for leave and
follow their own requests; an admin manages the employee list and approves or rejects
every request.

Built for the Millennium Information Solution fresher assessment.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| Backend | Java 21, Spring Boot 4.1.1, Spring Web MVC, Spring Data JPA |
| Auth | Spring Security as an OAuth2 resource server — JWT bearer tokens, BCrypt passwords |
| Database | H2, in-memory, seeded on every start |
| API docs | springdoc-openapi (Swagger UI) |
| Containers | Docker, multi-stage builds, Docker Compose |

## Running it

Docker is the only prerequisite.

```bash
docker compose up --build
```

| | |
|---|---|
| App | <http://localhost:3000> |
| API | <http://localhost:8080> |
| Swagger UI | <http://localhost:8080/swagger-ui.html> |
| H2 console | <http://localhost:8080/h2-console> — JDBC `jdbc:h2:mem:leavedb`, user `sa`, no password |

### Sign in

| Email | Password | Role |
|---|---|---|
| `admin@mis.com` | `admin123` | Admin |
| `alice@mis.com` | `alice123` | Employee |
| `bob@mis.com` | `bob123` | Employee |
| `carol@mis.com` | `carol123` | Employee |

The admin and employee accounts are also printed on the login page. The database lives in
memory, so `docker compose restart backend` resets everything to the seeded state.

### Try the whole flow in a minute

1. Sign in as **alice@mis.com** → **Leaves** → *Apply for leave* → it appears as `PENDING`.
2. Sign out, sign in as **admin@mis.com** → **Leaves** → you can see every employee's
   request → *Approve* Alice's.
3. Sign back in as Alice → the request now reads `APPROVED`, and its Edit and Withdraw
   buttons are gone.

### Running without Docker

See [`backend/README.md`](backend/README.md) (`./gradlew bootRun`) and
[`frontend/README.md`](frontend/README.md) (`pnpm install && pnpm dev`). The backend must
be started first.

## Repository layout

```
.
├── docker-compose.yml    Brings up both services
├── backend/              Spring Boot REST API   → backend/README.md
├── frontend/             Next.js web UI         → frontend/README.md
└── ARCHITECTURE.md       How it all fits together, in detail
```

Each half has its own README covering that side in depth. **[`ARCHITECTURE.md`](ARCHITECTURE.md)**
is the written explanation of the system as a whole: the request flow end to end, the key
components, and the Docker setup.

## Architecture at a glance

```
┌──────────────────────┐         ┌──────────────────────────────────────┐
│  Browser             │         │  Backend container :8080             │
│  ┌────────────────┐  │         │  ┌────────────────────────────────┐  │
│  │ Next.js app    │  │  HTTPS  │  │ Spring Security filter chain   │  │
│  │ (React, all    │──┼─ JSON ──┼─▶│   verifies the JWT signature   │  │
│  │  client-side)  │  │  + JWT  │  │   and loads the roles          │  │
│  └────────────────┘  │         │  └───────────────┬────────────────┘  │
│         │            │         │                  ▼                   │
│  localStorage        │         │  Controller → Service → Repository   │
│  holds the token     │         │                  │                   │
└──────────────────────┘         │                  ▼                   │
   Frontend container :3000      │           H2, in-memory              │
   (serves the page only)        └──────────────────────────────────────┘
```

The frontend container **only serves the page**. Every API call goes from the browser
straight to the backend — the two containers never talk to each other. That is why
`NEXT_PUBLIC_API_URL` is `http://localhost:8080` (the browser's view) and not
`http://backend:8080` (the Docker network's view).

## The API

All endpoints except login require an `Authorization: Bearer <token>` header.

| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/login` | public |
| GET | `/api/auth/me` | any signed-in user |
| GET | `/api/employees`, `/api/employees/{id}` | any signed-in user |
| POST | `/api/employees` | admin |
| PUT / DELETE | `/api/employees/{id}` | admin |
| GET | `/api/leaves` | admin sees all, employee sees their own |
| GET | `/api/leaves/{id}` | owner or admin |
| POST | `/api/leaves` | any signed-in user, always filed for the caller |
| PUT / DELETE | `/api/leaves/{id}` | owner, only while `PENDING` |
| PATCH | `/api/leaves/{id}/status` | admin |

```bash
TOKEN=$(curl -s -X POST localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@mis.com","password":"admin123"}' | jq -r .token)

curl localhost:8080/api/leaves -H "Authorization: Bearer $TOKEN"
```

## Data model

Two tables. An **employee row is also the login account** — the email and password used to
sign in live on it, and `role` decides what that account may do.

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

A request is created as `PENDING`; an admin moves it to `APPROVED` or `REJECTED`, and that
decision is final.

## Tests

```bash
cd backend && ./gradlew test
```

Ten tests covering the parts with real logic: login and token verification, role-scoped
listing, the forced `PENDING` status on create, cross-employee access, the admin decision,
and the conflict when a decided request is changed again.

## Deliberate simplifications

Stated rather than hidden, since each is a real trade-off:

| Choice | Why | What it would take to change |
|---|---|---|
| One `Employee` table doubles as the user table | A separate user entity would be 1:1 with it | A `users` table and a join |
| No DTO layer — entities are returned directly, with the password field write-only | A mirror-image DTO plus a mapper per entity is a lot of code for no behaviour | DTOs once the API shape needs to diverge from the DB |
| Token in `localStorage` | Simple and explainable end to end; XSS could read it | httpOnly cookie plus a proxy route and cookie config |
| In-memory database | No volume, no setup, always a clean demo | Swap the datasource URL for Postgres |
| The frontend route guard is UI only | The token is unreadable server-side | Nothing — the backend already re-checks every request |

The last one is the important one: the guard hides UI, it does not protect data. Every
request is authorised again on the server, so knowing a URL gets you nothing.

## Development history

The commit history follows the order the app was built: backend domain → auth → employee
CRUD → leave CRUD → Docker, then the frontend in the same order. Each commit is one working
feature with its documentation.
