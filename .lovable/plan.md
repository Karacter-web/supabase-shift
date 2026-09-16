# Deep Call Flow — Python backend → Node.js (Supabase + Vercel)

## Phase 1 — Inventory (complete, nothing modified)

Cloned `Karacter-web/deep-call-flow` (shallow) into a scratch folder.

**Key finding:** the repo is not a Python-only project. It already contains a
complete TypeScript/Supabase app (TanStack Start) next to a legacy Python
FastAPI service. Most of the migration has already happened; what remains is a
small set of Python-only capabilities.

```text
deep-call-flow/
├── backend/            legacy Python (FastAPI + Socket.io)
│   ├── main.py         entry point, ASGI app
│   ├── config.py       pydantic-settings config
│   ├── routes/twilio_routes.py
│   ├── services/       stt.py, translation.py, tts.py, twilio_stream.py
│   ├── ws_hub.py       in-memory Socket.io hub
│   └── api/index.py    Vercel Python entry
├── src/                existing TypeScript app (already Supabase-backed)
│   ├── routes/api/public/twilio/  voice, sms, status, transcription, outbound
│   ├── lib/telephony.functions.ts (11 server functions)
│   └── lib/voice.functions.ts
└── supabase/migrations/  8 migrations, RLS everywhere
```

- Framework: FastAPI 0.115 + python-socketio, uvicorn.
- ORM / DB layer: **none** — the Python service is stateless; all persistence
  already lives in Supabase via the TypeScript side.
- Auth: **none in Python** (open endpoints). TypeScript side uses Supabase Auth
  with an `_authenticated` route gate, `user_roles` table and a `has_role`
  security-definer function.
- Env vars read by Python: `FRONTEND_ORIGIN`, `PUBLIC_BASE_URL`,
  `STT_PROVIDER`, `WHISPER_MODEL`, `GOOGLE_STT_CREDENTIALS`,
  `TRANSLATION_PROVIDER`, `DEEPL_API_KEY`, `GOOGLE_TRANSLATE_API_KEY`,
  `DEFAULT_TARGET_LANG`, `TTS_PROVIDER`, `ELEVENLABS_API_KEY`,
  `ELEVENLABS_VOICE_ID`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_PHONE_NUMBER`.
- Third-party: Twilio (voice + Media Streams), OpenAI Whisper (local model),
  DeepL, Google Translate/STT/TTS, ElevenLabs.

### Python endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | liveness |
| POST | `/process-audio` | audio upload → Whisper transcript |
| POST | `/translate` | DeepL/Google translation |
| POST | `/synthesize` | ElevenLabs/Google TTS → MP3 |
| WS | `/ws/studio` | studio settings/ping channel |
| POST | `/incoming-call` | Twilio voice webhook → TwiML `<Stream>` |
| WS | `/stream-audio` | Twilio Media Streams → STT → translation |
| Socket.io | `connect`, `settings`, `start_call`, `end_call`, `disconnect` | realtime fan-out |

## Phase 2 — Migration plan

### Route mapping

| Python | Node.js target | Notes |
| --- | --- | --- |
| `GET /health` | `src/routes/api/public/health.ts` | trivial |
| `POST /process-audio` | `transcribeAudio` server fn | Whisper → hosted STT API |
| `POST /translate` | `translateText` server fn | DeepL REST via fetch |
| `POST /synthesize` | `synthesizeSpeech` server fn | ElevenLabs REST, returns MP3 |
| `POST /incoming-call` | already exists: `api/public/twilio/voice.ts` | uses real-time transcription callbacks, not Media Streams |
| `WS /stream-audio` | already replaced by `api/public/twilio/transcription.ts` | see gaps |
| `WS /ws/studio` + Socket.io | Supabase Realtime on `call_sessions` / `call_transcripts` | no long-lived sockets on serverless |

### Database mapping

Nothing to migrate: Python holds no tables. Supabase schema already covers
`profiles`, `user_roles`, `phone_numbers`, `call_sessions`, `call_transcripts`,
`voice_models`, `voice_samples`, `sms_messages`, plus a storage bucket for voice
samples. Studio settings currently held in the Python in-memory hub move onto
`call_sessions` (source/target language, translation and tuning toggles), since
serverless workers keep no state between requests.

### Auth mapping

Python endpoints are unauthenticated. In Node they split two ways:
`/process-audio`, `/translate`, `/synthesize` become authenticated server
functions (Supabase bearer token, RLS as the signed-in user); Twilio webhooks
stay under `/api/public/*` with signature verification in the handler.

### Deployment shape

Single TanStack Start app, not one Vercel function per route. Reasoning: the
frontend and backend already share one build, server functions give typed RPC
with shared auth middleware, and the repo's root `vercel.json` already targets
the Nitro Vercel preset. Adding a parallel `/api/*.js` function set would
duplicate auth, Supabase client setup and Twilio signing.

### Env var mapping

| Old (Python) | New | Action |
| --- | --- | --- |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Twilio connector credentials | already gateway-backed |
| `PUBLIC_BASE_URL` | `PUBLIC_BASE_URL` | set to the deployed URL |
| `DEEPL_API_KEY` | `DEEPL_API_KEY` | re-issue |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | same | re-issue key |
| `GOOGLE_TRANSLATE_API_KEY`, `GOOGLE_STT_CREDENTIALS` | same | optional providers |
| `FRONTEND_ORIGIN` | dropped | same-origin app |
| `WHISPER_MODEL`, `STT_PROVIDER` | dropped | local Whisper cannot run serverless |

### Dependencies dropped / added

Dropped: fastapi, uvicorn, python-socketio, websockets, pydantic(-settings),
python-multipart, openai-whisper, deepl, twilio, httpx.
Added: nothing new beyond the existing stack — `@supabase/supabase-js`, zod and
native `fetch` cover all of it.

### Gaps that cannot be ported as-is

1. **Local Whisper** — no Node equivalent; must call a hosted transcription API.
2. **Twilio Media Streams WebSocket** — serverless cannot hold a socket; the
   TypeScript side already uses Twilio Real-Time Transcription callbacks instead.
3. **`audioop` mu-law decode / sound tuning** — no stdlib equivalent; dropped
   along with the Media Streams path.
4. **Socket.io fan-out** — replaced by Supabase Realtime subscriptions.

## Phases 3–6

Scaffold, port route-by-route, smoke-test each endpoint, then produce the
Vercel/Supabase env checklist. The original `backend/` folder stays untouched
until verification passes.

## Blocker before any code is written

This workspace is currently an empty project and Lovable Cloud is switched off,
so no database, auth or server-side code can be created here yet. The cloned
repository also needs to be brought into this project before Phases 3–6 can run.
