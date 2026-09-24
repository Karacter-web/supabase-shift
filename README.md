# Karacter Hub | Deep Call Live

Real-time call studio: inbound Twilio calls are transcribed, translated and streamed
live into a split-screen operator UI.

Single Node app — React + TanStack Start (Vite), Tailwind CSS, Supabase (auth, data,
storage, realtime). All server logic runs as TanStack server functions and server
routes in `src/`. There is no separate Python service any more.

## Setup

```bash
npm install
npm run dev               # http://localhost:8080
```

### Structure

```
src/
├── routes/                          # pages + server routes (api/public/*)
├── lib/*.functions.ts               # server functions (telephony, voice, media)
├── context/CallStudioContext.tsx    # call/translation/language state
└── components/call/                 # studio UI (audio input, transcripts, controls)
```

## Docker

```bash
docker compose up --build            # http://localhost:3000
```

For Twilio, point `PUBLIC_BASE_URL` at a public HTTPS origin and set the number's
voice webhook to `POST /api/public/twilio/voice?t=$TWILIO_WEBHOOK_TOKEN`.

## Server endpoints (former Python routes)

| Legacy Python | Node replacement |
| --- | --- |
| `GET /health` | `src/routes/api/public/health.ts` |
| `POST /incoming-call` | `src/routes/api/public/twilio/voice.ts` |
| `POST /synthesize` | `synthesizeSpeech` in `src/lib/media.functions.ts` |
| `POST /process-audio` | `src/routes/api/public/process-audio.ts` — ElevenLabs Scribe v2 |
| `POST /translate` | `src/routes/api/public/translate.ts` — DeepL, LLM fallback |
| `WS /stream-audio` (Media Streams) | **open gap** — see [DEFERRED.md](./DEFERRED.md) |
| `WS /ws/studio` + Socket.io hub | Supabase Realtime on `call_sessions` / `call_transcripts` |

Speech-to-text (ElevenLabs Scribe v2), translation (DeepL with an LLM
fallback), speech synthesis and voice cloning (ElevenLabs Flash v2.5 / Instant
Voice Cloning) are all live. The one remaining gap is the Twilio Media Streams
transport for in-call translation — read `DEFERRED.md`.

See [DEPLOY.md](./DEPLOY.md) for deployment and environment variables.
