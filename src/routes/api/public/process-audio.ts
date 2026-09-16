import { createFileRoute } from "@tanstack/react-router";

/**
 * Ported surface for the legacy Python `POST /process-audio` (Whisper STT).
 *
 * TODO(deferred): intentionally stubbed — see DEFERRED.md.
 *   (a) Hosted Google STT wiring is blocked until billing is enabled on the
 *       Google Cloud project; no substitute STT vendor may be introduced.
 *   (b) The low-latency live-audio path (Twilio Media Streams) still has no
 *       serverless-compatible design; the Twilio transcription callback route
 *       is NOT accepted as its replacement.
 * Returns an explicit 501 rather than a silent no-op or fake success.
 */
export const Route = createFileRoute("/api/public/process-audio")({
  server: {
    handlers: {
      POST: async () =>
        Response.json(
          {
            error: "not_implemented",
            detail:
              "Audio transcription is deferred until Google Cloud billing is enabled. See DEFERRED.md.",
          },
          { status: 501 },
        ),
    },
  },
});
