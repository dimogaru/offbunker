# TravelHub

Spanish-language travel management PWA for organizing trips, flights, accommodations, itineraries, documents, and collaborative sharing.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — cookie signing key

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite, TanStack Query 5, shadcn/ui, Wouter routing
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: express-session + connect-pg-simple (pg session store), bcryptjs
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- DB schema: `lib/db/src/schema/` — trips, flights, parking, rentals, accommodations, itinerary, documents, users, trip-shares
- OpenAPI spec: `lib/api-spec/` → generates `lib/api-zod/` (Zod schemas) and `lib/api-client-react/` (React Query hooks)
- API routes: `artifacts/api-server/src/routes/`
- Frontend pages: `artifacts/travel-hub/src/pages/`
- Frontend modules: `artifacts/travel-hub/src/components/modules/`
- Auth context: `artifacts/travel-hub/src/hooks/use-auth.tsx`

## Architecture decisions

- **Contract-first API**: OpenAPI spec is source of truth; all Zod schemas and React Query hooks are generated from it via Orval. Never hand-write API client code.
- **Session auth**: express-session with a PostgreSQL store (`connect-pg-simple`, `createTableIfMissing: true`). Session cookie: httpOnly, secure, sameSite:lax, 7-day TTL.
- **Trip access middleware**: `GET|HEAD /trips/:tripId/*` is guarded in `routes/index.ts` — it resolves owner/shared permission and attaches `req.tripAccess`. Write methods (`POST/PATCH/DELETE`) are blocked for `view`-only shares.
- **Offline session**: auth state is mirrored to `localStorage` (`travelhub-auth-user`). On mount the hook verifies with `/api/auth/me`; if offline, the cached user is kept so the UI still renders.
- **Date columns**: Drizzle `date()` columns expect `string` (YYYY-MM-DD) but Zod `z.coerce.date()` parses to `Date`. Routes cast with `as unknown as string` before Drizzle calls — safe at runtime since Drizzle serialises JS Dates correctly.

## Product

- **Login / roles**: session-based login page (Spanish). Roles: `user` (default) and `superadmin`. Superadmin is seeded on startup (username = password = `52557586X`) and lands on `/admin`.
- **Dashboard**: lists owned trips plus trips shared with the user (badged "Compartido"). Edit/delete hidden for non-owners.
- **Trip detail**: full module tabs — Vuelos, Parking, Alquiler, Alojamiento, Itinerario, Documentos. Non-owners with `view` permission see read-only UI (all add/edit/delete controls hidden).
- **Sharing**: trip owners can generate a public share link (token-based) and invite specific users with `edit` or `view` permission via a ShareModal.
- **Superadmin panel** (`/admin`): full user CRUD — create, rename, change password, delete users.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Do not run `pnpm dev` at the workspace root — use `restart_workflow` instead.
- After schema changes run `pnpm --filter @workspace/db run push` (dev) and re-seed the superadmin if the users table was dropped.
- `routes/index.ts` trip-access middleware runs on `/trips/:tripId` prefix — all sub-routes inherit the `req.tripAccess` payload without re-querying.
- `(req as unknown as Record<string, unknown>).tripAccess` is the pattern for accessing the middleware-set property because `"types": ["node"]` in the api-server tsconfig prevents global Express module augmentation.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
