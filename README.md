<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/def84b34-813c-44a3-9726-818829c5ea17

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Authentication and production deployment

Read [AUTHENTICATION.md](AUTHENTICATION.md) before deploying this release.
Login now uses Supabase Auth email/password accounts and requires the coordinated
profile/RLS migration. Legacy fallback credentials are removed. Backend secrets
belong in `.env`; public browser configuration belongs in `.env.local`.
Run `npm run test:auth` for authentication middleware tests.
