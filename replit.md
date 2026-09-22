# SpotJiggy

A full-stack jigsaw puzzle platform where users upload images, slice them into puzzles, share individual piece URLs, and players collect pieces to complete puzzles solo or in groups. Includes badges, a store for puzzle creator packs, and user profiles with activity feeds.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/spotjiggy run dev` — run the React frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional PayPal env: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENVIRONMENT` (`sandbox` or `live`), and `PAYPAL_RETURN_URL_BASE`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Wouter (routing) + Framer Motion (animations) + TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-zod/src/generated/` — generated Zod schemas and React Query hooks (do not edit)
- `lib/db/src/schema/` — Drizzle ORM table definitions (users, badges, puzzles, pieces, packages)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, puzzles, pieces, users, store)
- `artifacts/spotjiggy/src/pages/` — React page components
- `artifacts/spotjiggy/src/components/` — Shared components (Layout, PuzzleCard)
- `artifacts/spotjiggy/src/context/AuthContext.tsx` — Auth token management

## Architecture decisions

- **Contract-first API**: OpenAPI spec is the single source of truth; Orval generates hooks and Zod validators from it. Never write API types by hand.
- **Simple auth**: Base64-encoded `sub:timestamp` tokens in localStorage. The API server decodes the sub from the Bearer token. No JWT library needed for MVP.
- **Puzzle types**: `solo` (every player collects all pieces independently) vs `group` (each piece can only be collected once — players must cooperate).
- **Piece images**: Currently use the same image as the puzzle with position-based CSS clipping for the preview; extend to actual image slicing in production.
- **Store payments**: Checkout uses a server-side PayPal order/capture flow; it stays disabled until PayPal credentials are configured.

## Product

- **Home feed**: Browse trending and active puzzles; hero landing for logged-out users
- **Editor**: Create puzzles with image URL, cut style (grid/strips/jigsaw), piece count, solo/group mode
- **Play page**: See all pieces, collect them by clicking, share individual piece links, track progress
- **Profile**: View stats (pieces collected, badges, puzzles created/completed), activity feed, earned badges
- **Store**: Three puzzle creator packs (Starter 5/$4.99, Creator 15/$9.99, Pro 50/$24.99)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `import.meta.env.BASE_URL` must be stripped of trailing slash for Wouter's `base` prop
- API routes import Zod schemas from `@workspace/api-zod` — always run codegen after changing the OpenAPI spec
- Drizzle column names use camelCase in TypeScript but map to snake_case in Postgres (e.g. `passwordHash` → `password_hash`)
- Never run `pnpm dev` at the workspace root — use workflows instead

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- DB schema push: `pnpm --filter @workspace/db run push`
