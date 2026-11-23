# Todo App

A multi-user todo app. Each person registers, logs in, and sees only their own todos.

| Part | Stack |
|---|---|
| **API** (`api/`) | .NET 10, ASP.NET Core minimal APIs, Dapper + Npgsql, PostgreSQL 16, DbUp migrations, cookie auth |
| **Web** (`web/`) | React 19, Vite, TypeScript, React Router, TanStack Query |
| **Tests** | xUnit integration tests (real Postgres), Vitest + Testing Library + MSW, Playwright end-to-end |

```
todo-app/
├── api/
│   ├── TodoApi/            # the web API
│   │   ├── Data/           #   Dapper repositories, DbUp migrator, Migrations/*.sql
│   │   ├── Domain/         #   User, TodoItem
│   │   ├── Features/       #   Auth/ and Todos/ endpoints + DTOs
│   │   └── Infrastructure/
│   └── TodoApi.Tests/      # integration tests
├── web/                    # React app (src/, e2e/)
├── docker-compose.yml      # local Postgres
└── TodoApp.slnx
```

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) (`global.json` pins the 10.0 feature band)
- Node.js 22+ and npm
- PostgreSQL 16 — easiest via Docker, or any server you can reach

## Run it locally

**1. Database**

```bash
docker compose up -d db
```

This creates database `todoapp` (user `todoapp`, password `todoapp_dev`, port 5432). Those are throwaway dev defaults, matching `api/TodoApi/appsettings.Development.json`. Override them by copying `.env.example` to `.env`.

No Docker? Use any Postgres and create a matching role and database:

```sql
create role todoapp login password 'todoapp_dev';
create database todoapp owner todoapp;
```

**2. API** — http://localhost:5080

```bash
dotnet run --project api/TodoApi --launch-profile http
```

In Development the API applies pending migrations on startup. OpenAPI is served at `/openapi/v1.json`.

**3. Web** — http://localhost:5173

```bash
cd web
npm install
npm run dev
```

Vite proxies `/api` to the API, so the browser only ever talks to one origin: the auth cookie works without any CORS setup.

## Tests

```bash
# API (needs Docker for Testcontainers, or point at a database you created)
dotnet test
TEST_DB_CONNECTION="Host=localhost;Port=5432;Database=todoapp_test;Username=todoapp;Password=todoapp_dev" dotnet test

# Web unit/component tests
cd web && npm test

# Web type-check, lint, production build
cd web && npm run typecheck && npm run lint && npm run build

# End-to-end (drives the real browser -> Vite -> API -> Postgres; starts API + Vite for you)
cd web && npx playwright install chromium   # first time only
npm run e2e
```

- The API tests boot the real app against a real Postgres. Set `TEST_DB_CONNECTION` to use a database you already have (create an empty `todoapp_test` first); otherwise a throwaway `postgres:16` container is started.
- The e2e run uses the dev database by default with uniquely named users. Set `E2E_DB_CONNECTION` to use a different one.

## API

All endpoints are under `/api`. Bodies are JSON; errors are RFC 9457 problem details.

| Method | Route | Notes |
|---|---|---|
| POST | `/auth/register` | `{ email, password }` (password 8–128 chars). 201, signs you in. 409 if the email is taken. |
| POST | `/auth/login` | 200 sets the auth cookie. 401 with one generic message for a wrong password, an unknown email, or a locked account. |
| POST | `/auth/logout` | 204 |
| GET | `/auth/me` | `{ id, email }`, or 401 |
| GET | `/todos?status=all\|active\|completed` | Your todos, newest first. 400 on an unknown status. |
| POST | `/todos` | `{ title (≤200), notes? (≤2000) }` → 201 + `Location` |
| GET / PUT / PATCH / DELETE | `/todos/{id}` | PUT `{ title, notes }`; PATCH `{ isCompleted }`; DELETE → 204 |
| DELETE | `/todos/completed` | `{ deleted: n }` |

`/api/health` checks the database connection.

## Design notes

- **Per-user data.** Every `TodoRepository` method takes the owner's id and filters on it in SQL. A todo that belongs to someone else is indistinguishable from one that doesn't exist (404, never 403). Tests cover read, update, complete, delete and bulk-clear across two users.
- **Auth without ASP.NET Identity.** Identity's stores are tied to EF Core, so auth is a small custom layer: a `users` table, the framework's `PasswordHasher` (PBKDF2, per-hash salt), and cookie authentication. The cookie is `HttpOnly` and `SameSite=Lax` (and `Secure` outside Development), so page scripts never see the credential. API calls answer 401/403 rather than redirecting.
- **Brute-force and enumeration.** Five failed logins lock the account for 15 minutes. Unknown emails and locked accounts still pay for a password hash, so response time doesn't reveal which emails are registered. `/api/auth/*` is rate limited (20 requests/min per IP by default; `RateLimiting:AuthPermitLimitPerMinute`).
- **Migrations.** Plain SQL in `api/TodoApi/Data/Migrations/`, applied once each in name order by DbUp (history in the `schemaversions` table). Add `0002_…sql` for the next change. Outside Development run `dotnet TodoApi.dll --migrate`.
- **Frontend state.** Todos are fetched once and filtered client-side, so tab switches are instant and counts are free. Toggle, delete and clear-completed are optimistic and roll back with an error message if the server refuses. Logging in or out clears cached todos so one account never briefly shows another's.
- **Package versions.** NuGet's newest Microsoft packages are now the 11.x line; the API pins `10.0.x` to match the .NET 10 SDK.

## Configuration

| Setting | How | Default |
|---|---|---|
| Database | `ConnectionStrings__Default` env var, or user-secrets | dev DB in `appsettings.Development.json` |
| Auth rate limit | `RateLimiting__AuthPermitLimitPerMinute` | `20` |

Never commit real credentials: `.env`, `secrets.json` and `appsettings.*.local.json` are git-ignored.

## Not included (yet)

Deployment (Dockerfiles, serving `web/dist` from the API), email confirmation and password reset, social login, due dates, tags/priorities, search.
