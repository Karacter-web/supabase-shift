# Deferred work — live (in-call) translation transport

Status: **one item open.** Speech-to-text and speech synthesis are no longer
deferred — they run on ElevenLabs.

## Done (previously deferred)

| Surface | State |
| --- | --- |
| `POST /api/public/process-audio` | live — ElevenLabs Scribe v2 batch transcription |
| `POST /api/public/translate` | live — DeepL (`DEEPL_API_KEY`) with an LLM fallback |
| `transcribeAudio`, `translateAudioText`, `synthesizeSpeech` (`src/lib/media.functions.ts`) | live |
| Voice cloning (`trainVoiceModel` in `src/lib/voice.functions.ts`) | live — ElevenLabs Instant Voice Cloning |

`GOOGLE_STT_CREDENTIALS` is no longer used anywhere.

## Still open: Twilio Media Streams transport

Twilio Media Streams needs the server to hold a bidirectional WebSocket open
for the whole call. The Vercel deployment cannot do this: serverless functions
have no WebSocket upgrade path, and edge functions only do one-way response
streaming with a short execution ceiling.

ElevenLabs' own "Agents + Twilio" native integration does not apply here — it
is built for a bot answering a caller, not for interpreting between two live
human speakers.

### Proposed shape (not built)

A small standalone Node relay on a host that allows long-lived sockets
(Fly.io / Railway / Render / a VM), separate from the Vercel app:

```text
Twilio call ──(Media Streams WS, 8 kHz mu-law)──> Node relay
  relay ──> ElevenLabs Scribe v2 Realtime (mu-law native, no conversion)
  relay ──> DeepL / LLM translation step
  relay ──> ElevenLabs Flash v2.5 TTS (ulaw_8000 out)
  relay ──(media frames)──> Twilio  +  transcript rows ──> Supabase
```

Tradeoffs to sign off before building:

- Latency: ~150 ms Scribe partial + ~200–400 ms translation + ~300 ms Flash
  TTS + network ≈ **0.8–1.2 s** from end of phrase to translated speech.
  Translation being a separate step sets the floor.
- Cost: relay host ≈ $5–10/month at small size, plus per-minute Scribe and
  per-character DeepL and ElevenLabs usage.
- Ops: second deploy target, its own secrets, and a Supabase service key so
  the relay writes the transcript rows the app already streams live.

`src/routes/api/public/twilio/transcription.ts` (Twilio's own real-time
transcription callbacks) stays as a near-real-time transcript record. It is
**not** accepted as closure of this gap.
