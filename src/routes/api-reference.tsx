import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/landing/PageShell";

const ENDPOINTS = [
  { method: "GET", path: "/api/public/health", body: "Service liveness check." },
  { method: "POST", path: "/api/public/twilio/voice", body: "TwiML webhook for inbound calls." },
  {
    method: "POST",
    path: "/api/public/twilio/transcription",
    body: "Twilio real-time transcription callbacks.",
  },
  { method: "POST", path: "/api/public/twilio/status", body: "Call status callbacks." },
  { method: "POST", path: "/api/public/twilio/sms", body: "Inbound SMS webhook." },
  {
    method: "POST",
    path: "/api/public/process-audio",
    body: "Speech-to-text (ElevenLabs Scribe v2). Multipart audio or base64 JSON; needs ?t= token.",
  },
  {
    method: "POST",
    path: "/api/public/translate",
    body: "Translation (DeepL, LLM fallback). JSON { text, targetLang, sourceLang }; needs ?t= token.",
  },

];

export const Route = createFileRoute("/api-reference")({
  head: () => ({
    meta: [
      { title: "API Reference — Karacter Hub | Deep Call Live" },
      {
        name: "description",
        content: "HTTP and WebSocket endpoints for speech-to-text, translation, text-to-speech and Twilio streaming.",
      },
      { property: "og:title", content: "API Reference — Karacter Hub | Deep Call Live" },
      {
        property: "og:description",
        content: "Endpoints for STT, translation, TTS and Twilio media streaming.",
      },
    ],
  }),
  component: () => (
    <PageShell title="API Reference" intro="Endpoints exposed by the Deep Call Live backend.">
      <ul className="space-y-3">
        {ENDPOINTS.map((e) => (
          <li key={e.path} className="panel-surface rounded-xl p-4">
            <p className="font-mono text-xs text-primary">
              {e.method} <span className="text-foreground">{e.path}</span>
            </p>
            <p className="mt-1">{e.body}</p>
          </li>
        ))}
      </ul>
    </PageShell>
  ),
});
