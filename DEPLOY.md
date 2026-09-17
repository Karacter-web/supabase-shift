# Deployment

Single Node deployment — the app and all its server routes ship together. The
former Python service has been removed.

## App (Vercel)

This is a TanStack Start (React + Vite + Nitro) app — not Next.js — so Vercel
must build it with the Nitro Vercel preset. `vercel.json` already does this:

```json
{
  "buildCommand": "NITRO_PRESET=vercel npm run build",
  "outputDirectory": ".vercel/output"
}
```

Steps:

1. Import the repository in Vercel (Framework preset: **Other**).
2. Add the environment variables from `.env` / `.env.example`:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `LOVABLE_API_KEY`, `TWILIO_API_KEY`, `TWILIO_WEBHOOK_TOKEN`
   - `PUBLIC_BASE_URL` — the deployed https origin (e.g. `https://your-app.vercel.app`)
   
3. Deploy. The Twilio webhooks are then served at:
   - `POST https://<domain>/api/public/twilio/voice?t=$TWILIO_WEBHOOK_TOKEN`
   - `POST https://<domain>/api/public/twilio/transcription?t=$TWILIO_WEBHOOK_TOKEN`
   - `POST https://<domain>/api/public/twilio/status?t=$TWILIO_WEBHOOK_TOKEN`

Numbers purchased through the app are configured with `PUBLIC_BASE_URL` (falling back to
the Lovable published URL), so set it before buying numbers on Vercel.

## Live audio limitation

Vercel serverless functions cannot hold long-lived WebSockets, so a Twilio Media
Streams socket has no home here. The live transcription path used by Call Studio
runs on this app's own public webhook routes and needs no extra service; the
lower-latency Media Streams path stays open (see `DEFERRED.md`) and would need a
small Node WebSocket service on a container host (Fly.io, Render, Railway, Cloud Run).

## Environment variables

Client (build-time, safe to expose):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SENTRY_DSN` (optional)

Server (runtime, secret):
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY` (speech synthesis / translation via the Lovable AI gateway)
- `TWILIO_API_KEY`
- `TWILIO_WEBHOOK_TOKEN` (shared token validated on the public Twilio routes)
- `PUBLIC_BASE_URL` (absolute base URL used to build Twilio callback URLs)
- `SENTRY_AUTH_TOKEN` (build-time only, for source map upload)

Not required yet, deferred with transcription/translation: `GOOGLE_STT_CREDENTIALS`.

Storage buckets (private, already created): `voice-samples` (25 MB/file),
`call-recordings` (50 MB/file). Both are restricted to the owning user's
folder; admins can also read call recordings.
