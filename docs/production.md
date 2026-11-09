# Production deployment

## Required account access

- Renew GitHub secret `SUPABASE_ACCESS_TOKEN` with a Supabase access token permitted to manage the configured project. The token must include Database and Edge Functions with Read-write access. A read-scoped token executes as supabase_read_only_user and cannot apply schema changes. Project Settings and Auth Config also need Read-write access if OAuth settings require repair. Token scopes never override a read-only project membership. Until the deployment workflow succeeds, server-side hardening is not active. Never put the token in source or a chat message.
- The deployment workflow verifies OAuth redirects, deploys the independent authenticated `extract-profile`, applies the idempotent atomic quota migration in a transaction, then deploys `chat`. Supabase CLI is pinned and deployment confirmation is explicit (`--yes`). A migration failure prevents deployment of code that needs it.
- The existing production website deploys from `main` independently of GitHub Actions. Verify the live site after pushing.

## Signed distribution

Set repository variable `SIGNED_RELEASES=true` only after configuring these Actions secrets:

- macOS: `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
- Windows: `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`.

The signed configuration requires signing and macOS notarization. Missing credentials fail the release. Without this variable, installers are explicitly labelled unsigned previews; they are not signed production installers. Never instruct users to disable OS security globally.

## Verification

`bun run check` runs security, session migration, API failure tests and both TypeScript checks. CI runs a real PostgreSQL concurrency test: forty competing requests must respect the same quota, and repeated refunds must decrement exactly once. Run `tests/quota-concurrency.py` only against an empty, isolated test database via `TEST_DATABASE_URL`.

Release jobs run the checks before packaging. Tag version must match `package.json` and all three installers must exist before publication.

## Data and costs

- Desktop OAuth callbacks must match a single-use, ten-minute state initiated by this running app. Replays, unsolicited callbacks and callbacks after app termination are rejected; restart sign-in if necessary.
- Desktop tokens are encrypted using Electron safeStorage (macOS Keychain / Windows DPAPI). When secure OS storage is unavailable or denies encryption, new sessions remain in memory; no plaintext fallback is written. Existing plaintext sessions migrate on first load. Supabase localStorage persistence is disabled in desktop renderers; existing session keys are removed. Browser OAuth keeps its own PKCE storage.
- Screenshots can only be read/deleted from Aura's capture directory, and new files use owner-only permissions. Manual attachments persist until removed. Background capture files are removed in `finally`.
- Reactive observation starts off, skips identical captures, stops after twenty submitted analyses, and offers Pause on the collapsed orb. The counter is an explicit per-activation budget, not a billing meter.
- Provider output is bounded; calls time out. Provider errors contain a request ID, never raw provider diagnostics, screenshots or tokens.
- Quota reservations count before provider calls. Failed provider requests are refunded idempotently. If a function is terminated before finalization, its reservation remains charged conservatively; investigate pending reservations before manual reconciliation rather than granting automatic extra credit.

## Monitoring and rollback

Search function logs by `requestId` and events `provider_error`, `chat_failed`, `quota_unavailable`, `quota_refund_failed`. Do not add screenshots, prompts, access tokens or raw upstream errors to logs. An external alerting destination still needs to be configured by the account owner.

Keep the previous published installer available as a rollback. Do not deploy the new chat function without applying its migration first. Do not delete completed reservation rows until the chosen reconciliation/retention window has elapsed.
