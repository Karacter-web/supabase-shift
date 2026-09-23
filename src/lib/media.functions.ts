import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SAMPLE_LINES } from "@/lib/voice.functions";

/**
 * Node replacements for the legacy Python media endpoints.
 *
 * Speech-to-text runs on ElevenLabs Scribe v2, translation is a separate
 * DeepL/LLM step, and speech synthesis runs on ElevenLabs Flash v2.5.
 */

const transcribeSchema = z.object({
  /** Base64-encoded audio (no data: prefix). */
  audio: z.string().min(1),
  mimeType: z.string().max(80).default("audio/webm"),
  /** 2-letter UI language code; omit to auto-detect. */
  language: z.string().max(5).nullable().optional(),
  diarize: z.boolean().default(true),
});

export type TranscriptSegment = {
  text: string;
  start: number | null;
  end: number | null;
  speaker: string | null;
};

/** Port of Python `POST /process-audio`, now backed by ElevenLabs Scribe v2. */
export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => transcribeSchema.parse(input))
  .handler(
    async ({
      data,
    }): Promise<{ text: string; language: string | null; segments: TranscriptSegment[] }> => {
      const { transcribeWithScribe, toIso3 } = await import("@/lib/elevenlabs.server");
      const bytes = Buffer.from(data.audio, "base64");
      if (bytes.byteLength === 0) throw new Error("No audio was received.");

      const result = await transcribeWithScribe(
        new Blob([new Uint8Array(bytes)], { type: data.mimeType }),
        { languageCode: toIso3(data.language), diarize: data.diarize },
      );

      return {
        text: result.text ?? "",
        language: result.language_code ?? null,
        segments: (result.words ?? []).map((word) => ({
          text: word.text,
          start: word.start ?? null,
          end: word.end ?? null,
          speaker: word.speaker_id ?? null,
        })),
      };
    },
  );

const translateSchema = z.object({
  text: z.string().min(1).max(5000),
  targetLang: z.string().min(2).max(5),
  sourceLang: z.string().min(2).max(5).nullable().optional(),
});

/**
 * Port of Python `POST /translate`. Kept as its own step: ElevenLabs does
 * voice conversion, not cross-language translation.
 */
export const translateAudioText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => translateSchema.parse(input))
  .handler(async ({ data }): Promise<{ text: string; translated: string }> => {
    const { translateText } = await import("@/lib/translate.server");
    const translated = await translateText(
      data.text,
      data.targetLang,
      data.sourceLang ?? undefined,
    );
    if (!translated) throw new Error("Translation is unavailable right now.");
    return { text: data.text, translated };
  });

const synthesizeSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().max(60).nullable().optional(),
  gender: z.string().max(20).default("neutral"),
  language: z.string().max(8).default("en"),
  speed: z.number().min(0.5).max(1.5).default(1),
  stability: z.number().min(0).max(1).default(0.5),
  similarity: z.number().min(0).max(1).default(0.75),
});

/**
 * Port of Python `POST /synthesize`, back on ElevenLabs (Flash v2.5).
 *
 * Behavioural difference kept on purpose: the original was an unauthenticated
 * endpoint returning raw audio/mpeg; this is authenticated and returns base64
 * MP3, so it can't be used anonymously to burn synthesis credits.
 */
export const synthesizeSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => synthesizeSchema.parse(input))
  .handler(async ({ data }): Promise<{ audio: string; text: string }> => {
    const { synthesizeWithElevenLabs, resolveVoiceId } = await import("@/lib/elevenlabs.server");
    const text = (data.text.trim() || SAMPLE_LINES[data.language] || SAMPLE_LINES["en"]) as string;

    const audio = await synthesizeWithElevenLabs(text, {
      voiceId: resolveVoiceId(data.voiceId, data.gender),
      stability: data.stability,
      similarity: data.similarity,
      speed: data.speed,
    });

    return { audio: Buffer.from(audio).toString("base64"), text };
  });
