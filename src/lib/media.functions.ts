import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SAMPLE_LINES } from "@/lib/voice.functions";

/**
 * Node replacements for the legacy Python media endpoints.
 *
 * `transcribeAudio` and `translate` are deliberately stubbed — see DEFERRED.md.
 * `synthesizeSpeech` is a live port of Python `POST /synthesize`.
 */

/**
 * TODO(deferred): Python `POST /process-audio`. Blocked on Google Cloud
 * billing (hosted Google STT) and on the unresolved low-latency live-audio
 * architecture question. Do not substitute another STT vendor.
 */
export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<never> => {
    throw new Error(
      "Not implemented: audio transcription is deferred until Google Cloud billing is enabled (see DEFERRED.md).",
    );
  });

/**
 * TODO(deferred): Python `POST /translate`. Paused with the STT work; the
 * Twilio transcription callback path is not accepted as a substitute.
 */
export const translateAudioText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<never> => {
    throw new Error(
      "Not implemented: standalone translation is deferred (see DEFERRED.md).",
    );
  });

const synthesizeSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().max(60).nullable().optional(),
  language: z.string().max(8).default("en"),
  speed: z.number().min(0.5).max(1.5).default(1),
});

/**
 * Port of Python `POST /synthesize`.
 *
 * Behavioural differences, recorded deliberately:
 * - ElevenLabs is replaced by the Lovable AI gateway's speech endpoint, so no
 *   ELEVENLABS_API_KEY has to be re-issued.
 * - The original returned raw `audio/mpeg` bytes from an unauthenticated
 *   endpoint. This is an authenticated server function returning base64 MP3,
 *   so a public endpoint can't be used to burn synthesis credits.
 */
export const synthesizeSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => synthesizeSchema.parse(input))
  .handler(async ({ data }): Promise<{ audio: string; text: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Speech synthesis is not configured yet.");

    const text = (data.text.trim() || SAMPLE_LINES[data.language] || SAMPLE_LINES["en"]) as string;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: text,
        voice: data.voiceId || "alloy",
        speed: data.speed,
        response_format: "mp3",
        stream_format: "audio",
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Speech synthesis failed [${res.status}]: ${body}`);
      if (res.status === 429) throw new Error("Too many requests right now — try again shortly.");
      if (res.status === 402) throw new Error("Speech synthesis needs more AI credits on this workspace.");
      throw new Error(`Speech synthesis failed (${res.status}).`);
    }

    return { audio: Buffer.from(await res.arrayBuffer()).toString("base64"), text };
  });
