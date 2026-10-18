# Inbox sync deployment

Follow [AUTHENTICATION.md](AUTHENTICATION.md) first. Create Google OAuth client
credentials with gmail.readonly scope and obtain a refresh token through an
administrator-controlled OAuth flow. Keep GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET,
GMAIL_REFRESH_TOKEN and SYNC_KEY in Supabase Edge secrets only.

Use a random SYNC_KEY of at least 32 characters. Deploy sync-gmail with the
checked-in config. Schedulers must send the secret in the x-sync-key header;
remove old URLs containing ?key=. Interactive callers need a real Auth JWT and
an active profile with sauda access. The public anon key is not accepted.
The function exchanges the refresh token for a short-lived Gmail access token
and uses its server-held service-role key to write inbox records.
