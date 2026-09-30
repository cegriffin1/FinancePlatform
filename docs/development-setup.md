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

## ALTUS local validation rule (build / dev)

**Never run `next build` (`npm run build`) while `next dev` is actively using the same `.next` directory.**

Sharing `.next` between build and an active dev server can corrupt the cache and produce false `500`s on `/` until `.next` is cleared and dev is restarted.

Canonical validation sequence:

1. Stop `next dev` cleanly
2. `npm run test`
3. `npm run typecheck`
4. `npm run lint`
5. `npm run build`
6. Restart `npm run dev`
7. Browser smoke (homepage + assessment)
8. Staging E2E (`scripts/staging/validate-foundation-e2e.mjs` or project equivalent)

If `/` returns 500 after a build/dev collision: stop dev → `rm -rf .next` → `npm run dev` → re-smoke.

## Canonical Direct Retirement source (homepage)

Homepage assessment uses stable slugs (not hard-coded UUIDs):

- organization: `altus`
- campaign: `retirement-opportunity` (`owner_type = ALTUS_PLATFORM_CAMPAIGN`)

Ensure it exists in the linked Supabase project before Supabase-mode browser work:

```bash
set -a && source .env.local && set +a
ALTUS_BOOTSTRAP_CONFIRM=YES node scripts/bootstrap/ensure-direct-retirement-source.mjs
```

Staging fixture seeder also ensures this canonical source (separate from `altus-test-org-*` E2E fixtures).

In `ALTUS_DATA_MODE=supabase`, the assessment UI must not silently fall back to simulation when session creation fails.

## Campaign media (Slice A)

- Private Supabase Storage bucket: `campaign-media`
- Object path: `{organization_id}/{asset_id}/{safe_filename}`
- Metadata table: `public.media_assets` (migration `20260929110000_campaign_media_assets.sql`)
- Allowed types: JPG/JPEG, PNG, WEBP, MP4, PDF — originals preserved (no silent compress/transcode)
- Access: authenticated Next.js APIs → `requireOrgAuth` → service_role upload + short-lived signed URLs
- **Migration path:** `20260929100000` remains local-only / unapplied. Do **not** `db push` / apply media migration until the 100000 apply path is resolved (do not repair/squash/mark applied).
- **Future hardening:** production-scale malware/antivirus scanning for uploads is not part of Slice A.

## Branch policy

- Work on feature branches (e.g. `feature/platform-foundation`)
- Do not commit directly to `main`
- Never commit secrets

## Architecture reminder

Keep business logic out of React components. Call application services and domain interfaces from server actions / route handlers.
