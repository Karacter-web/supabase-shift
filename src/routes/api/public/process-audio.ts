import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Node replacement for the legacy Python `POST /process-audio`.
 *
 * Speech-to-text now runs on ElevenLabs Scribe v2 (no Google billing
 * dependency). This endpoint accepts multipart audio or base64 JSON and is
 * guarded by the shared `?t=` token so it can't be used anonymously.
 */
export const Route = createFileRoute("/api/public/process-audio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const expected = process.env["TWILIO_WEBHOOK_TOKEN"];
        if (!expected || url.searchParams.get("t") !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { transcribeWithScribe, toIso3 } = await import("@/lib/elevenlabs.server");
        const contentType = request.headers.get("content-type") ?? "";

        let blob: Blob;
        let language: string | null = url.searchParams.get("language");

        try {
          if (contentType.includes("multipart/form-data")) {
            const form = await request.formData();
            const file = form.get("file") ?? form.get("audio");
            if (!(file instanceof Blob)) {
              return Response.json({ error: "missing_audio" }, { status: 400 });
            }
            blob = file;
            language = (form.get("language") as string | null) ?? language;
          } else {
            const body = z
              .object({
                audio: z.string().min(1),
                mimeType: z.string().max(80).optional(),
                language: z.string().max(5).optional(),
              })
              .parse(await request.json());
            blob = new Blob([new Uint8Array(Buffer.from(body.audio, "base64"))], {
              type: body.mimeType ?? "audio/webm",
            });
            language = body.language ?? language;
          }
        } catch {
          return Response.json({ error: "invalid_request" }, { status: 400 });
        }

        try {
          const result = await transcribeWithScribe(blob, { languageCode: toIso3(language) });
          return Response.json({
            text: result.text ?? "",
            language: result.language_code ?? null,
            segments: (result.words ?? []).map((w) => ({
              text: w.text,
              start: w.start ?? null,
              end: w.end ?? null,
              speaker: w.speaker_id ?? null,
            })),
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Transcription failed";
          console.error("process-audio failed:", detail);
          return Response.json({ error: "transcription_failed", detail }, { status: 502 });
        }
      },
    },
  },
});
