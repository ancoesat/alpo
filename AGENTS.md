# AGENTS.md

## Project overview

This repo is a small full-stack app with:

- ASP.NET Core Web API in [KBYTE](KBYTE)
- Next.js frontend in [kbyte-client](kbyte-client)
- MySQL-backed local setup via [docker-compose.yml](docker-compose.yml)

Use this file as the starting point for repo-specific conventions before making changes.

## Architecture and key files

- API entry point: [KBYTE/Program.cs](KBYTE/Program.cs)
- Data layer: [KBYTE/Data/ApplicationDbContext.cs](KBYTE/Data/ApplicationDbContext.cs)
- Controllers: [KBYTE/Controllers](KBYTE/Controllers)
- Models and DTOs: [KBYTE/Models](KBYTE/Models), [KBYTE/DTOs](KBYTE/DTOs)
- Frontend app: [kbyte-client/src/app](kbyte-client/src/app)
- Frontend package scripts: [kbyte-client/package.json](kbyte-client/package.json)
- Frontend setup notes: [kbyte-client/README.md](kbyte-client/README.md)

## Run and verify commands

### Backend (ASP.NET Core)

From the repo root:

```bash
dotnet restore KBYTE/KBYTE.csproj
dotnet build KBYTE/KBYTE.csproj
dotnet run --project KBYTE/KBYTE.csproj
```

This app uses MySQL through EF Core and seeds a default asset list at startup in [KBYTE/Program.cs](KBYTE/Program.cs).

### Frontend (Next.js)

From the repo root:

```bash
cd kbyte-client
npm install
npm run dev
```

Production build check:

```bash
cd kbyte-client
npm run build
```

### Full stack with Docker

```bash
docker compose up --build
```

This is the canonical local setup described in [docker-compose.yml](docker-compose.yml).

## Project conventions

- Keep API and UI responsibilities separated: backend logic lives under [KBYTE](KBYTE), frontend UI lives under [kbyte-client/src](kbyte-client/src).
- Prefer DTOs for request/response contracts and keep business logic in controller/service patterns already used by the app.
- Follow the existing naming and route style: controllers use `[Route("api/[controller]")]` and the app exposes endpoint names such as `api/dashboard` and `api/transactions`.
- Preserve the current Turkish API messages and comments unless the task is specifically about language cleanup.
- When changing database models, check [KBYTE/Data/ApplicationDbContext.cs](KBYTE/Data/ApplicationDbContext.cs) and the existing migrations under [KBYTE/Migrations](KBYTE/Migrations).

## Common pitfalls

- The backend expects MySQL connection details from environment configuration; if local startup fails, check [docker-compose.yml](docker-compose.yml) first.
- The app seeds default assets when the database is empty; do not assume empty startup means a broken setup.
- The frontend calls the API using `NEXT_PUBLIC_API_URL`; defaults are set in [docker-compose.yml](docker-compose.yml) and should be preserved when editing environment handling.
- Use the repo-root layout when running commands; avoid assuming the project is a single app root.

## Before making changes

- Read the relevant controller/model file before editing behavior.
- Prefer the smallest possible change in either the API or the UI, and keep the frontend/backend contracts consistent.
- If a change affects data schema, migrations, or assets, inspect [KBYTE/Program.cs](KBYTE/Program.cs) and the EF Core context together.

## Helpful references

- [docker-compose.yml](docker-compose.yml)
- [KBYTE/Program.cs](KBYTE/Program.cs)
- [KBYTE/Controllers/TransactionsController.cs](KBYTE/Controllers/TransactionsController.cs)
- [KBYTE/Controllers/DashboardController.cs](KBYTE/Controllers/DashboardController.cs)
- [kbyte-client/package.json](kbyte-client/package.json)
- [kbyte-client/README.md](kbyte-client/README.md)
