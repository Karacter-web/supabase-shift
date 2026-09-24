import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/landing/PageShell";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Docs — Karacter Hub | Deep Call Live" },
      {
        name: "description",
        content: "Setup guides for connecting Twilio, configuring your numbers and using the Call Studio.",
      },
      { property: "og:title", content: "Docs — Karacter Hub | Deep Call Live" },
      {
        property: "og:description",
        content: "Setup guides for Twilio, phone numbers and the Call Studio.",
      },
    ],
  }),
  component: () => (
    <PageShell title="Docs" intro="Get Deep Call Live running end to end.">
      <p>
        <strong className="text-foreground">1. Run the app.</strong> Everything — call handling,
        voice synthesis and the studio UI — runs in this single app. Start it with{" "}
        <code className="font-mono">npm run dev</code> or{" "}
        <code className="font-mono">docker compose up</code>.
      </p>
      <p>
        <strong className="text-foreground">2. Point Twilio at it.</strong> Set your number's voice
        webhook to <code className="font-mono">/api/public/twilio/voice</code> on your public URL.
        Twilio posts transcription events to{" "}
        <code className="font-mono">/api/public/twilio/transcription</code>.
      </p>
      <p>
        <strong className="text-foreground">3. Open the Call Studio.</strong> The studio streams
        live from your call session and shows incoming and translated text side by side, with
        translation and sound tuning toggles.
      </p>
      <p>
        <strong className="text-foreground">4. Configure keys.</strong> Twilio for calls,
        ElevenLabs for transcription, speech and voice cloning, and DeepL for translation. See{" "}
        <code className="font-mono">DEPLOY.md</code> for the full list.
      </p>
      <p>
        <strong className="text-foreground">5. Build your own voice.</strong> On the Voice models
        page, create a voice, upload a few clear recordings, then press “Train this voice” to clone
        it so it speaks your translated replies on calls.
      </p>
    </PageShell>
  ),
});

