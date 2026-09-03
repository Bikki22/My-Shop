# Client

Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4 + shadcn/ui, with
Clerk authentication wired to the Express API in `../server`.

## Setup

```bash
cp .env.example .env.local   # then fill in the Clerk keys
npm run dev
```

The Clerk keys **must** come from the same Clerk application the server uses —
the server verifies the session tokens this app sends, so mismatched
applications fail every authenticated request with a 401.

Server Components call the API from Node, which sends no `Origin` header, so
CORS does not apply to them. Browser-side calls via `useApi()` do need it, and
`server/src/app/config/env.ts` defaults `CORS_ORIGINS` to `http://localhost:5173`.
Before fetching from a Client Component, add to `server/.env`:

```
CORS_ORIGINS=http://localhost:3000
CLIENT_URL=http://localhost:3000
```

## Folder structure

```
src/
├── app/                        routing only — layouts, pages, error boundaries
│   ├── (auth)/                 sign-in & sign-up, no site header
│   ├── (marketing)/            public pages
│   ├── (protected)/            guarded by requireUser() in its layout
│   ├── forbidden.tsx           403 boundary, rendered by forbidden()
│   └── layout.tsx              document shell + provider stack
├── components/
│   ├── ui/                     shadcn primitives (generated — don't hand-edit)
│   ├── layout/                 header, footer, shells
│   └── providers/              the app-wide provider stack
├── config/                     env, routes, site metadata
├── features/                   vertical slices — one folder per domain
│   └── auth/
│       ├── api/                endpoint definitions
│       ├── components/         auth UI
│       ├── hooks/              client-side data hooks
│       ├── server/             server-only guards and loaders
│       ├── permissions.ts      role predicates
│       └── types.ts            wire types mirroring the server model
├── lib/api/                    the HTTP layer (see below)
└── proxy.ts                    Next 16's middleware, running Clerk
```

Route groups (`(auth)`, `(marketing)`, `(protected)`) don't appear in the URL —
they exist to give each area its own layout and guard. All three are layouts at
`/`, which is why each takes `LayoutProps<"/">`.

Feature slices own their own components, hooks and types. Anything shared by two
features moves up to `components/` or `lib/`; nothing in `app/` should hold
business logic.

## The API layer

`lib/api/http.ts` is the only place that calls the Express server. It prefixes
`/api/v1`, attaches the Clerk bearer token, unwraps the `{ success, data }`
envelope, and turns any failure into a thrown `ApiError` carrying the server's
status and field-level validation details.

Two bindings sit on top of it:

- `lib/api/server.ts` — `serverApi()` for Server Components, Route Handlers and
  Server Actions, taking the token from `auth()`.
- `lib/api/client.ts` — `useApi()` for Client Components, taking the token from
  `useAuth()`. The token is fetched per request because Clerk's are short-lived.

## Authorization

Roles (`USER`, `MERCHANT`, `ADMIN`, `SUPER_ADMIN`) live in **our** MongoDB, not
in Clerk. Clerk establishes identity; `GET /api/v1/user/me` supplies the role.
So Clerk's own `<Show when={{ role }}>` and `has()` helpers don't apply here —
they read Clerk organization roles. Use these instead:

| Layer | Tool | Purpose |
| - | - | - |
| Session | `src/proxy.ts` | Attaches the Clerk session so `auth()` works |
| Server | `requireUser()` / `requireAdmin()` | Enforces access; redirects or renders 403 |
| Client | `<RoleGate roles={…}>` | Hides UI only |

The proxy deliberately does **no** path-based protection. `createRouteMatcher`
is deprecated in Clerk Core 3 because matcher patterns can diverge from how
Next actually routes a request, silently leaving resources reachable. Checks
live where the data is read instead.

`RoleGate` is cosmetic — a client-side check is trivially bypassed. Every
protected page must call a server guard, and the API enforces it regardless.

## Notes

- `experimental.authInterrupts` is enabled in `next.config.ts` because
  `forbidden()` still sits behind that flag in Next 16.
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` are required, not optional.
  The proxy runs before React and never sees the `ClerkProvider` props, so
  without them guests get sent to Clerk's hosted portal instead of the local
  sign-in page. Verified by smoke test.
- `typedRoutes` is on, so `Link href` values are checked against real routes.
  Clerk's catch-all pages register as `/sign-in/[[...sign-in]]`, so the literal
  `"/sign-in"` isn't a valid typed href — use Clerk's own redirect helpers.
- Every route renders dynamically because the root layout reads the session to
  populate `CurrentUserProvider`. If you add pages that should be static, move
  the provider down into the layouts that actually need it.
