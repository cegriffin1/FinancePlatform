# Development Setup

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (or local Supabase CLI)
- Git

## Bootstrap

```bash
cd ~/Projects/FinancePlatform
cp .env.example .env.local
# fill values — never commit .env.local
npm install
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

## Environment variables

See `.env.example` for names only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `NEXT_PUBLIC_APP_URL`
- `USE_MOCK_PROVIDERS`

## Database

Apply migrations from `supabase/migrations/` using the Supabase CLI or SQL editor.

```bash
npx supabase db push
# or link + migrate per your Supabase workflow
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright (requires app + env) |

## Branch policy

- Work on feature branches (e.g. `feature/platform-foundation`)
- Do not commit directly to `main`
- Never commit secrets

## Architecture reminder

Keep business logic out of React components. Call application services and domain interfaces from server actions / route handlers.
