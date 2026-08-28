# Rash frontend

Next.js 15 (Pages Router) + React 19 + Tailwind CSS v4, built as a **static export**
and served from S3 behind CloudFront.

## Running locally

```bash
npm install
npm run dev          # http://localhost:3000
```

To run the frontend against the local FastAPI service instead of the deployed API:

```bash
cd ../scripts
uv run run_local.py  # starts the frontend and the API together
```

## How it talks to the API

There are **no Next.js API routes** — `next.config.ts` sets `output: 'export'`, so the
app compiles to static files and no server runtime exists.

`lib/config.ts` decides the API base at *runtime* by hostname:

- on `localhost` → `http://localhost:8000` (the local FastAPI service)
- anywhere else → `''`, so requests go to relative `/api/*` paths, which CloudFront
  routes to API Gateway

That means `NEXT_PUBLIC_API_URL` is **not** used by the deployed site. Routing lives in
the CloudFront `/api/*` cache behavior, not in the bundle.

## Environment

`.env.local` (development) and `.env.production.local` (build) supply the Clerk keys:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk client SDK |
| `CLERK_SECRET_KEY` | Clerk server verification |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Post-sign-in redirect |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Post-sign-up redirect |

These files are gitignored. See `.env.example` at the repository root.

## Layout

| Path | Contents |
| --- | --- |
| `pages/` | Routes — dashboard, accounts, advisor team, analysis, error pages |
| `components/` | Layout, brand, icons, and the `ui/` primitives |
| `lib/` | API base resolution, formatting, events, and the `theme/` system |
| `styles/globals.css` | The Ruled Ledger token layer — the only place colour literals appear |

## Design system

The interface follows the "Ruled Ledger" direction: information is separated by
**rules rather than containers**, radius stays within a 0–4px band, chrome spends no
saturated colour, and saturation is reserved for meaning (positive, negative, warning,
agent). Type is IBM Plex Sans / Sans Condensed / Mono, loaded via `next/font/google`.

Light and dark resolve from the same semantic roles under the document's `data-theme`
attribute, so components reference roles instead of colour literals and need no `dark:`
duplication.

Full rationale and token values: [docs/DESIGN_SYSTEM.md](../docs/DESIGN_SYSTEM.md).

## Building and deploying

```bash
npm run build        # emits ./out
```

Deployment (upload, cache headers, CloudFront invalidation) is documented in
[docs/FRONTEND_DEPLOY.md](../docs/FRONTEND_DEPLOY.md).
