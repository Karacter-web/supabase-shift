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
        <strong className="text-foreground">3. Open the Call Studio.</strong> The studio subscribes
        to the live socket stream and shows incoming and translated text side by side, with
        translation and sound tuning toggles.
      </p>
      <p>
        <strong className="text-foreground">4. Configure keys.</strong> Copy{" "}
        <code className="font-mono">.env.example</code> and fill in your Twilio, translation and
        speech provider credentials.
      </p>
    </PageShell>
  ),
});
