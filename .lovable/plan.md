# ElevenLabs swap, translation step, live-call design, voice models

## 1. Answer first: voice model / voice actor feature status

It was **not** missed — it exists and works, with one real gap.

Working today (`/voice-models` page):
- 6 preset voices listed, plus create/delete of your own voices.
- Upload of recordings straight into the private `voice-samples` store, playback
  of each recording, deletion, and per-voice tuning (consistency, likeness,
  pace, pitch) saved against the voice.
- Picking which voice is used on calls.
- A spoken preview of a voice.

The gap: uploaded recordings are stored but **never sent anywhere to actually
clone the voice**. The voice is marked "training" and never becomes a real
cloned voice, so `provider_voice_id` stays empty and previews fall back to a
generic stock voice. This plan closes that with ElevenLabs Instant Voice
Cloning.

## 2. Persistent-connection design (report, not yet built)

**Answer to question 1: no.** This app is deployed as serverless/edge
functions. Neither shape can hold a bidirectional Twilio Media Streams
WebSocket open for the length of a call: serverless functions have no WebSocket
server upgrade path at all, and edge streaming is one-way response streaming
with a short execution ceiling, not a duplex socket.

**Proposed shape (question 2)** — a small standalone Node relay, deployed
separately on a host that allows long-lived sockets (Fly.io or Railway;
Render also works). The main app stays on Vercel.

```text
Twilio call ──(Media Streams WS, 8kHz mu-law)──> Node relay (Fly.io)
   relay ──> ElevenLabs Scribe v2 Realtime (mu-law native, no conversion)
   relay ──> DeepL (or LLM) translate transcript segment
   relay ──> ElevenLabs Flash v2.5 TTS (mu-law 8kHz out)
   relay ──(media frames back)──> Twilio  +  transcript rows -> Supabase
```

Tradeoffs to sign off before building:
- Latency budget per utterance: ~150ms Scribe partial, ~200-400ms translation,
  ~300ms Flash TTS, plus network — roughly **0.8-1.2s** from end of a phrase to
  translated speech. Lower is not achievable while translation is a separate
  step.
- Cost: relay host ~$5-10/month idle-small, plus per-minute Scribe, per-character
  DeepL and per-character ElevenLabs usage.
- Operational: a second deploy target, its own secrets, and a shared Supabase
  service key so the relay can write transcripts the app already reads live.
- The async Twilio transcription callback stays only as a fallback transcript
  record; it is explicitly **not** the live path.

Nothing in this section gets built in this plan.

## 3. What this plan builds

**Credentials.** Link the ElevenLabs connector so the app gets an ElevenLabs
key server-side, and store `DEEPL_API_KEY` as a secret. Both are Vercel-side
today and are not available to this project yet.

**Speech to text.** Replace the Google-blocked stub:
- `POST /api/public/process-audio` and `transcribeAudio` call ElevenLabs Scribe
  batch transcription for uploaded/recorded audio (diarisation on, language
  auto-detect), returning the same response shape the old Python route did.
- Drop `GOOGLE_STT_CREDENTIALS` and its "not yet available" wording everywhere.

**Translation (separate step).** A `translateText` server helper backed by DeepL
with an LLM fallback, used by `/api/public/translate`, by the transcript path,
and later by the relay. ElevenLabs is never treated as doing translation.

**Text to speech.** Point `synthesizeSpeech` and the voice preview at
ElevenLabs Flash v2.5, using a voice's cloned `provider_voice_id` when present
and a mapped stock voice otherwise, honouring the saved tuning values.

**Voice cloning (closes the gap in section 1).** A `trainVoiceModel` server
function: pulls that voice's recordings from the `voice-samples` store, posts
them to ElevenLabs Instant Voice Cloning, saves the returned voice ID onto
`voice_models.provider_voice_id`, sets provider to `elevenlabs` and status to
`ready` (or `failed` with the reason). The voice page gets a "Train this voice"
button with live status, disabled until at least one recording exists.

**Docs.** `DEFERRED.md` reduced to the single genuinely open item (the live
relay); `README.md`, `DEPLOY.md`, `TODO.md`, `roadmap.md`, and the in-app Docs
and API Reference pages updated to match.

## 4. Technical notes

- No schema change needed: `voice_models.provider_voice_id`, `provider` and
  `status` already exist, as does `voice_samples.file_path`.
- Cloning and transcription read sample bytes server-side via the service-role
  Supabase client, inside the handler only.
- ElevenLabs is called directly at `api.elevenlabs.io` with the `xi-api-key`
  header from the linked connector; `output_format` goes in the query string.
- `/api/public/*` routes keep their token check; the authenticated server
  functions keep `requireSupabaseAuth`.
- Verification: typecheck, build, then smoke the health, transcribe, translate
  and synthesize routes plus a clone round-trip on a test voice.
