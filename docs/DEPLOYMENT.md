# Deployment

## Commands

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e   # requires app server / Playwright config
npm run build
```

## Environment variables (pilot)

| Variable | Purpose |
|----------|---------|
| `PROVIDER_MODE` | Set `LIVE` only when provider secrets are configured (webhooks fail closed) |
| `META_WEBHOOK_SECRET` / `META_APP_SECRET` | Meta webhook HMAC |
| `LINKEDIN_WEBHOOK_SECRET` / `LINKEDIN_CLIENT_SECRET` | LinkedIn webhook HMAC |
| `GOOGLE_ADS_WEBHOOK_SECRET` | Google webhook HMAC |
| `ALTUS_CRM_PROVIDER` | `dynamics365` only if D365 adapter configured; default Altus CRM |
| Supabase URL/keys | Required for authenticated multi-tenant persistence beyond sim store |

## Pilot checklist

1. Run quality gates above
2. Confirm `PROVIDER_MODE` is not `LIVE` unless secrets exist
3. Review `/admin/mvp` pending queues
4. Counsel/compliance review of consent copy before paid traffic
5. Do **not** merge unreviewed pilot branches to `main` without release approval
