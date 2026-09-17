# Deferred work — transcription & live translation

Status: **paused by decision, not closed.** Revisit these first when work resumes.

## What is stubbed

| Surface | State |
| --- | --- |
| `POST /api/public/process-audio` (was Python `/process-audio`) | returns HTTP 501 `not_implemented` |
| `POST /api/public/translate` (was Python `/translate`) | returns HTTP 501 `not_implemented` |
| `transcribeAudio`, `translateAudioText` in `src/lib/media.functions.ts` | throw an explicit "Not implemented" error |
| Twilio Media Streams live audio path (was Python `WS /stream-audio`) | **not ported, gap still open** |

Every stub carries a `TODO(deferred)` comment pointing back here.

## Why

1. **Google Cloud Speech-to-Text now requires billing**, and billing is
   deliberately not enabled while the app is still in development. No other STT
   vendor may be substituted to route around this.
2. **Low-latency live translation during a call is unresolved.** Twilio Media
   Streams delivers raw audio over a long-lived WebSocket, which standard
   serverless functions cannot hold open. `src/routes/api/public/twilio/transcription.ts`
   (Twilio Real-Time Transcription callbacks) delivers text *after* Twilio's own
   STT has run: different latency, and no control over the STT engine. It is
   used for near-real-time transcripts, but it is **not** accepted as the
   closure of the Media Streams gap.

## Open questions to answer on resume

- Wire hosted Google STT once billing is enabled on the Google Cloud project —
  which model/region, and who owns the credentials.
- Decide the live-audio architecture: a persistent process outside serverless
  (Fly.io / Render / Cloud Run container running a small Node WebSocket service),
  or an explicit acceptance of callback latency. The old Python service has been
  removed, so this would be built fresh in Node.

## Not deferred

Everything else in the migration is done against the live Supabase schema:
telephony, SMS, voice models, history, storage buckets, health endpoint and
speech synthesis.
