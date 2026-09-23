import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Short, natural sample lines used when the user hasn't typed their own. */
export const SAMPLE_LINES: Record<string, string> = {
  en: "Hi, thanks for calling Karacter Hub — how can I help you today?",
  es: "Hola, gracias por llamar a Karacter Hub. ¿En qué puedo ayudarle hoy?",
  fr: "Bonjour, merci d'appeler Karacter Hub. Comment puis-je vous aider ?",
  de: "Hallo, danke für Ihren Anruf bei Karacter Hub. Wie kann ich helfen?",
  pt: "Olá, obrigado por ligar para a Karacter Hub. Como posso ajudar hoje?",
  tr: "Merhaba, Karacter Hub'ı aradığınız için teşekkürler. Size nasıl yardımcı olabilirim?",
  ar: "مرحباً، شكراً لاتصالك بـ Karacter Hub. كيف يمكنني مساعدتك اليوم؟",
  yo: "Pẹlẹ o, ẹ ṣeun fun pipe Karacter Hub. Báwo ni mo ṣe lè ràn yín lọ́wọ́?",
  ha: "Sannu, na gode da kiran Karacter Hub. Ta yaya zan taimaka maka yau?",
  ig: "Ndewo, daalụ maka ịkpọ Karacter Hub. Kedu ka m ga-esi nyere gị aka?",
};

const previewSchema = z.object({
  text: z.string().max(600).optional(),
  language: z.string().min(2).max(5).default("en"),
  gender: z.string().max(20).default("neutral"),
  style: z.string().max(30).default("conversational"),
  providerVoiceId: z.string().max(60).nullable().optional(),
  description: z.string().max(400).nullable().optional(),
  stability: z.number().min(0).max(1).default(0.5),
  similarity: z.number().min(0).max(1).default(0.75),
  speed: z.number().min(0.5).max(1.5).default(1),
  pitch: z.number().min(-10).max(10).default(0),
});

/** Generate a short spoken sample of a voice model with ElevenLabs. */
export const previewVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => previewSchema.parse(input))
  .handler(async ({ data }): Promise<{ audio: string; text: string }> => {
    const { synthesizeWithElevenLabs, resolveVoiceId } = await import("@/lib/elevenlabs.server");
    const text = (data.text?.trim() || SAMPLE_LINES[data.language] || SAMPLE_LINES["en"]) as string;

    const audio = await synthesizeWithElevenLabs(text, {
      voiceId: resolveVoiceId(data.providerVoiceId, data.gender),
      stability: data.stability,
      similarity: data.similarity,
      speed: data.speed,
    });

    return { audio: Buffer.from(audio).toString("base64"), text };
  });

const trainSchema = z.object({ voiceModelId: z.string().uuid() });

/**
 * Clone a user's voice with ElevenLabs Instant Voice Cloning from the
 * recordings they uploaded into the private `voice-samples` store, and save
 * the resulting voice id back onto the voice model so it can speak on calls.
 */
export const trainVoiceModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => trainSchema.parse(input))
  .handler(
    async ({ data, context }): Promise<{ providerVoiceId: string; sampleCount: number }> => {
      const supabase = context.supabase;

      const { data: voice, error: voiceError } = await supabase
        .from("voice_models")
        .select("id, name, description, is_preset")
        .eq("id", data.voiceModelId)
        .maybeSingle();
      if (voiceError) throw new Error(voiceError.message);
      if (!voice) throw new Error("That voice could not be found.");
      if (voice.is_preset) throw new Error("Built-in voices can't be retrained.");

      const { data: samples, error: sampleError } = await supabase
        .from("voice_samples")
        .select("id, file_path, label")
        .eq("voice_model_id", voice.id);
      if (sampleError) throw new Error(sampleError.message);
      if (!samples || samples.length === 0) {
        throw new Error("Upload at least one recording before training this voice.");
      }

      await supabase.from("voice_models").update({ status: "training" }).eq("id", voice.id);

      try {
        const files: Array<{ blob: Blob; filename: string }> = [];
        for (const sample of samples.slice(0, 25)) {
          const { data: file, error } = await supabase.storage
            .from("voice-samples")
            .download(sample.file_path);
          if (error || !file) throw new Error(error?.message ?? "A recording could not be read.");
          files.push({
            blob: file,
            filename: sample.label ?? sample.file_path.split("/").pop() ?? "sample.webm",
          });
        }

        const { cloneVoice } = await import("@/lib/elevenlabs.server");
        const providerVoiceId = await cloneVoice({
          name: `${voice.name} (${voice.id.slice(0, 8)})`,
          description: voice.description,
          samples: files,
        });

        const { error: updateError } = await supabase
          .from("voice_models")
          .update({
            provider: "elevenlabs",
            provider_voice_id: providerVoiceId,
            status: "ready",
          })
          .eq("id", voice.id);
        if (updateError) throw new Error(updateError.message);

        return { providerVoiceId, sampleCount: files.length };
      } catch (error) {
        await supabase.from("voice_models").update({ status: "failed" }).eq("id", voice.id);
        throw error instanceof Error ? error : new Error("Voice training failed.");
      }
    },
  );
