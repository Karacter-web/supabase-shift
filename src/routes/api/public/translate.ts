import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Node replacement for the legacy Python `POST /translate`.
 *
 * Translation stays a distinct step between speech-to-text and speech
 * synthesis: DeepL first, LLM fallback. Guarded by the shared `?t=` token.
 */
const bodySchema = z.object({
  text: z.string().min(1).max(5000),
  targetLang: z.string().min(2).max(5),
  sourceLang: z.string().min(2).max(5).optional(),
});

export const Route = createFileRoute("/api/public/translate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const expected = process.env["TWILIO_WEBHOOK_TOKEN"];
        if (!expected || url.searchParams.get("t") !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return Response.json({ error: "invalid_request" }, { status: 400 });
        }

        const { translateText } = await import("@/lib/translate.server");
        const translated = await translateText(body.text, body.targetLang, body.sourceLang);
        if (!translated) {
          return Response.json({ error: "translation_unavailable" }, { status: 502 });
        }
        return Response.json({ text: body.text, translated });
      },
    },
  },
});
