# Provider Security

## Rules

- OAuth client secrets and access/refresh tokens are **server-side only**.
- Browser never receives provider secrets or raw tokens.
- Tokens are sealed via `CredentialVault` (`PROVIDER_CREDENTIAL_ENCRYPTION_KEY`).
- API responses use `publicConnectionView` which strips `credential_ref`.
- Webhooks verify HMAC signatures when secrets are configured.
- Tenant isolation: connection and publish APIs validate organization ownership.
- Permissions: `integrations.manage`, `campaigns.publish`, `campaigns.approve`, `campaigns.budget.manage`.
- Cross-tenant campaign publish is rejected.
- External IDs are written by providers — not accepted as client-owned reassignment input.
- Audit events record connect/disconnect/publish/errors.

## Production secret architecture

1. Store Meta/LinkedIn/Google secrets in a managed secret store (e.g. Supabase Vault, AWS Secrets Manager, Doppler).
2. Inject into the server runtime only.
3. Encrypt token bundles with `PROVIDER_CREDENTIAL_ENCRYPTION_KEY` (or KMS-backed envelope encryption).
4. Rotate keys with dual-read support when upgrading vault implementations.

## Modes

| Mode | Behavior |
| --- | --- |
| SIMULATION (default) | Mock OAuth + mock publish; safe for tests |
| LIVE | Requires credentials + `ALLOW_LIVE_AD_PUBLISH=true` |
