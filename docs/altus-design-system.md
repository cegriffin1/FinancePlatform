# ALTUS Design System

Public resource hub visual language for the FinancePlatform / ALTUS product ecosystem.

## Tokens

Defined in `src/app/globals.css`:

- Primary `#0068B5`
- Deep `#004E8A`
- Navy / footer `#03263D` / `#031F32`
- Soft section `#F6F9FC` / `#EDF6FC`
- Text `#17324D` / `#66788A`
- Max content width `1180px`

## Components

Reusable building blocks under `src/components/altus/` and `src/components/brand/`:

- `AltusLogo` / `AltusMark`
- `AltusContainer`
- Hub sections (Nav, Hero, Metrics, Journey, Start Here, Insights, Recommendations, Reviews, Intelligence, CTA, Footer, Assistant)

These tokens and primitives are intended to extend into authenticated product surfaces (dashboard, campaigns, leads, pipeline, team, analytics, settings) without inventing a second visual system.

## Preservation

Hub UI does not replace authentication, Supabase, RLS, multi-tenancy, domain services, or Dynamics adapter boundaries.
