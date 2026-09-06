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
| Security | Spring Security | BCrypt password hashing; JWT is added in the next step. |
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

## Package layout

```
com.millennium.leave_tracker
├── domain/       JPA entities and enums — the shape of the data
├── repository/   Spring Data interfaces — the database access
├── config/       Security beans and the startup data seeder
├── service/      Business rules (added with the endpoints)
└── controller/   HTTP endpoints (added with the endpoints)
```

## Inspecting the database

With the app running, open <http://localhost:8080/h2-console> and connect with:

- JDBC URL: `jdbc:h2:mem:leavedb`
- User: `sa`, no password

> Until the security config lands in the next step, Spring Security guards every URL with
> a generated password printed in the startup log (`Using generated security password: …`),
> username `user`.
