# Connected Accounts (Marketing)

ALTUS Marketing → Connected Accounts lets organization admins connect Facebook, Instagram, TikTok, and LinkedIn business accounts.

Highwater Capital is the consumer brand; ALTUS stores connections org-scoped for marketing ops.

## Status honesty — SIMULATION ONLY foundation

| Capability | Status |
| --- | --- |
| Connected Accounts UI | Implemented |
| Simulation connect / disconnect / reconnect / sync | Implemented (in-memory) |
| Org-scoped API + RBAC (`integrations.view` / `integrations.manage`) | Implemented |
| Encrypted token vault (`credential_ref`) | Implemented (sim seals; not durable across restarts) |
| OAuth state HMAC + single-use consume | Implemented in-process; **not multi-instance durable** |
| LIVE provider OAuth redirects | **Hard-blocked** (`LIVE_SOCIAL_OAUTH_ENABLED=false`) |
| LIVE token exchange | **Not activated** — fail closed |
| Organic post publish | Placeholder — requires provider approval |
| Ad spend / campaign publish | Existing gate: `PROVIDER_MODE=LIVE` + `ALLOW_LIVE_AD_PUBLISH=true` |

Pending migration (review only, not applied): `supabase/migrations/20261030120000_oauth_state_nonces_and_connection_assets.sql`

## Platform mapping

| Card | OAuth provider | Notes |
| --- | --- | --- |
| Facebook | Meta | Shares connection with Instagram |
| Instagram | Meta | Requires IG professional account under Meta Business |
| TikTok | TikTok | Organic Content API ≠ Marketing API |
| LinkedIn | LinkedIn | Company Page + Campaign Manager products |

## Developer setup (LIVE — do not enable without approval)

1. Meta App (Facebook Login for Business + Marketing API) → `META_*`
2. LinkedIn Developer App + Ads / Community Management products → `LINKEDIN_*`
3. TikTok Developer App (Content Posting and/or Marketing) → `TIKTOK_*`
4. Set `PROVIDER_CREDENTIAL_ENCRYPTION_KEY` (and optional `OAUTH_STATE_SIGNING_SECRET`)
5. Redirect URIs → `/api/marketing/oauth/callback`
6. Complete App Review / partner approvals per provider
7. Implement LIVE token exchange in `SocialOAuthService.completeSocialOauthCallback`
8. Only then consider `PROVIDER_MODE=LIVE` (ad publish still needs `ALLOW_LIVE_AD_PUBLISH`)

## Safety

- `HIGHWATER_PUBLIC_LAUNCH` remains independent and should stay closed for consumer intake.
- Connected Accounts does not publish posts, spend budgets, or import consumer leads by itself.
