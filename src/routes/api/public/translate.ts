import { createFileRoute } from "@tanstack/react-router";

/**
 * Ported surface for the legacy Python `POST /translate` (DeepL/Google).
 *
 * TODO(deferred): intentionally stubbed — see DEFERRED.md. Standalone
 * translation is paused together with the STT work; it must not be quietly
 * backed by the Twilio real-time transcription path, which was flagged as a
 * behaviour change rather than an equivalent replacement.
 */
export const Route = createFileRoute("/api/public/translate")({
  server: {
    handlers: {
      POST: async () =>
        Response.json(
          {
            error: "not_implemented",
            detail:
              "Standalone translation is deferred alongside the speech-to-text work. See DEFERRED.md.",
          },
          { status: 501 },
        ),
    },
  },
});
