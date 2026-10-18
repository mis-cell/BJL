# Email deployment

Follow [AUTHENTICATION.md](AUTHENTICATION.md) for the coordinated security rollout.
Set GMAIL_USER, GMAIL_APP_PASSWORD and EMAIL_FROM only in backend/Edge secrets.
Rotate all previously exposed credentials; do not reuse values from Git history.
Deploy send-email with JWT verification enabled. Each caller must send a real
Auth access token and have an active operator profile with mail module access.
The public anonymous key alone is not authorization. Never use --no-verify-jwt
for send-email. The website sends email through its authenticated backend.
