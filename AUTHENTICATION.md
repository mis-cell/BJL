# Authentication and deployment

The application uses Supabase Auth email/password login. Passwords are verified
and hashed by Auth; they are never read from `user_master`. There is no fallback
administrator password. Operator permissions come from the linked database
profile, not localStorage, request bodies, or editable JWT user metadata.

## Components and request flow

1. `AuthScreen` passes email/password to `src/lib/auth.ts`.
2. `signInWithPassword` obtains an Auth access/refresh token pair over HTTPS.
3. `verifiedProfile` checks identity with `getUser` and loads the active operator
   profile by `auth_user_id`. Missing/inactive profiles deny login.
4. The Supabase SDK attaches JWTs to database calls. Row-level security enforces
   current profile status and module access. Profile changes require an admin.
5. `authFetch` attaches the current access token to Express API calls. The
   backend validates it with Auth and re-reads permissions on every request.
6. Edge functions separately verify JWT identity and current profile access.
   Inbox schedulers use a private `x-sync-key` header, never a URL query secret
   or the public anonymous key.

Tokens are stored by the SDK in sessionStorage (per browser tab), refreshed by
the SDK, and removed on sign-out. JavaScript can access this storage: preventing
XSS remains important. The old localStorage session format is discarded. The
15-minute inactivity timer signs out the operator. Configure access-token expiry
in Supabase Auth to 15 minutes; revoking a refresh token does not immediately
invalidate every already-issued access JWT. Other open tabs have independent
sessions. Backend restarts do not invalidate Auth sessions.

## Required rollout (staging first)

This is a breaking security migration. Do not deploy only the UI or only the SQL.
Back up the database and rehearse the following in a staging project first.
The migration assumes this project's public schema belongs to this application.

1. In Supabase Auth, disable public sign-ups, configure password strength
   (minimum 12 characters), rate limits and the production site URL. Enable
   secure password change/reauthentication and use HTTPS in production.
2. Create/invite a separate Auth account for each operator using the Auth
   dashboard. Use fresh passwords/reset invitations, not old plaintext values.
   Record each Auth UUID. Keep invitations and credentials out of source control.
3. In the SQL editor, add `auth_user_id uuid UNIQUE REFERENCES auth.users(id)`
   to `public.user_master` if missing. Link each existing operator's row to its
   Auth UUID. Check the linkage is unique. Explicitly set `status='Active'`,
   `role`, `level`, and canonical `allowed_modules` IDs. At least one linked
   administrator must exist before continuing. `ADMIN`/`ADMINISTRATOR` roles
   or level `L5` grant administration; `*` grants business modules, not admin.
4. Apply `migrations/20261018_authentication.sql` using an owner connection.
   It removes plaintext/hash columns from the application profile table,
   disables unlinked accounts, replaces existing public-schema RLS policies,
   revokes anonymous access (including views), and revokes browser RPC execution.
   It does not erase database backups or Git history.
5. Review `app_private.resource_modules` against actual operator workflows.
   Unknown tables are admin-only; missing permissions deny access. Entries grant
   CRUD access to the listed modules, including shared workflow tables. Add
   narrower read/write or row-specific policies where your business rules need
   them. Do not restore blanket policies or arbitrary SQL RPC access.
6. Set browser variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and, for
   static hosting, `VITE_API_BASE_URL`. Only the anonymous/public key belongs in
   browser builds. Configure the backend's `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, and explicit `ALLOWED_ORIGINS` separately.
7. Deploy the backend, frontend and Edge functions together. Set Gmail/OAuth,
   AI, Google Sheets feed and mail-provider secrets only in backend/function secret stores. Use
   `supabase functions deploy send-email` and deploy `sync-gmail` with its
   checked-in configuration. Set `SYNC_KEY` to at least 32 random characters;
   configure schedulers to pass it as `x-sync-key`. Remove old query-key jobs.
8. Test with an admin, a restricted operator, an inactive account, and no login.
   Verify direct REST reads/writes, RPC calls, cross-module calls, self-promotion,
   expired tokens, sign-out, password change, mail and AI. Existing automated
   middleware tests run with `npm run test:auth`; live RLS/Edge tests require the
   staging project and are not replaced by those unit tests.

The SMS feed now also uses the protected backend. Set `GOOGLE_SHEETS_ID` and
`GOOGLE_SHEETS_API_KEY` there; the website no longer contains a shared Google key.

## Administration and recovery

Create accounts, send recovery invitations and manage credentials in Supabase
Auth. The Admin Desk edits linked profile permissions only; it never manages
passwords. Schema changes use reviewed SQL migrations, not browser SQL editors.
Unreviewed RPC-based legacy reports and browser schema-edit controls are denied
until replaced by narrowly authorized database functions/migrations.

The service-role key bypasses RLS and must never reach the browser. All Express
API routes require identity and module authorization; unknown routes default to
admin-only. `/api/auth/session` is retired. API clients must send Auth bearer
tokens; anonymous health checks should use a separate infrastructure probe.

Rotate the previously committed Gmail app password and embedded Google/Gemini
keys in their provider consoles. Source edits do not revoke credentials or
remove historical exposure. Review provider activity and rotate any affected
service-role/OAuth secrets if they were shared or committed. Never reintroduce
real values in examples. Live rotation requires provider account access.

For rollback, restore a verified database backup and matching release in a
restricted maintenance environment; do not re-enable public plaintext login.
