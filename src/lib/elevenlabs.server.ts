/**
 * Server-only ElevenLabs helpers. Never import this from client code.
 *
 * ElevenLabs is linked as a direct-API connector, so calls go straight to
 * api.elevenlabs.io with the `xi-api-key` header.
 */

const API = "https://api.elevenlabs.io";

export function elevenLabsKey(): string {
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) throw new Error("ElevenLabs is not connected to this project.");
  return key;
}

function friendlyError(status: number, body: string, what: string): Error {
  console.error(`ElevenLabs ${what} failed [${status}]: ${body}`);
  if (status === 401) return new Error("The ElevenLabs connection was rejected — reconnect it.");
  if (status === 429) return new Error("ElevenLabs is rate limiting right now — try again shortly.");
  return new Error(`ElevenLabs ${what} failed (${status}).`);
}

export type ScribeWord = {
  text: string;
  start?: number;
  end?: number;
  speaker_id?: string;
};

export type ScribeResult = {
  text: string;
  language_code?: string;
  words?: ScribeWord[];
};

/**
 * Batch speech-to-text with Scribe. Replaces the old Whisper/Google STT path.
 * `languageCode` is ISO-639-3 (e.g. "eng"); omit it to auto-detect.
 */
export async function transcribeWithScribe(
  audio: Blob,
  options: { languageCode?: string | undefined; diarize?: boolean } = {},
): Promise<ScribeResult> {
  const form = new FormData();
  form.append("file", audio, "audio.webm");
  form.append("model_id", "scribe_v2");
  form.append("tag_audio_events", "false");
  form.append("diarize", options.diarize === false ? "false" : "true");
  if (options.languageCode) form.append("language_code", options.languageCode);

  const res = await fetch(`${API}/v1/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": elevenLabsKey() },
    body: form,
  });
  if (!res.ok) throw friendlyError(res.status, await res.text().catch(() => ""), "transcription");
  return (await res.json()) as ScribeResult;
}

export type TtsOptions = {
  voiceId: string;
  modelId?: string;
  stability?: number;
  similarity?: number;
  speed?: number;
  /** Non-mp3 output, e.g. "ulaw_8000" for Twilio. Defaults to mp3_44100_128. */
  outputFormat?: string;
};

/** Text-to-speech with Flash v2.5 (low latency), returning raw audio bytes. */
export async function synthesizeWithElevenLabs(
  text: string,
  options: TtsOptions,
): Promise<ArrayBuffer> {
  const format = options.outputFormat ?? "mp3_44100_128";
  const res = await fetch(
    `${API}/v1/text-to-speech/${options.voiceId}?output_format=${encodeURIComponent(format)}`,
    {
      method: "POST",
      headers: { "xi-api-key": elevenLabsKey(), "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: options.modelId ?? "eleven_flash_v2_5",
        voice_settings: {
          stability: options.stability ?? 0.5,
          similarity_boost: options.similarity ?? 0.75,
          use_speaker_boost: true,
          speed: Math.min(1.2, Math.max(0.7, options.speed ?? 1)),
        },
      }),
    },
  );
  if (!res.ok) throw friendlyError(res.status, await res.text().catch(() => ""), "speech synthesis");
  return res.arrayBuffer();
}

/** Instant Voice Cloning from recorded samples. Returns the new voice id. */
export async function cloneVoice(input: {
  name: string;
  description?: string | null;
  samples: Array<{ blob: Blob; filename: string }>;
}): Promise<string> {
  const form = new FormData();
  form.append("name", input.name.slice(0, 100));
  if (input.description) form.append("description", input.description.slice(0, 400));
  for (const sample of input.samples) form.append("files", sample.blob, sample.filename);

  const res = await fetch(`${API}/v1/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": elevenLabsKey() },
    body: form,
  });
  if (!res.ok) throw friendlyError(res.status, await res.text().catch(() => ""), "voice cloning");
  const json = (await res.json()) as { voice_id?: string };
  if (!json.voice_id) throw new Error("ElevenLabs did not return a voice id.");
  return json.voice_id;
}

/** Stock voices used when a voice model has no cloned voice of its own. */
const STOCK_VOICES: Record<string, string> = {
  female: "EXAVITQu4vr4xnSDxMaL", // Sarah
  male: "JBFqnCBsd6RMkjVDRZzb", // George
  neutral: "cgSgspJ2msm6clMCkdW9", // Jessica
};

export function resolveVoiceId(providerVoiceId: string | null | undefined, gender: string): string {
  if (providerVoiceId && providerVoiceId.trim()) return providerVoiceId.trim();
  return STOCK_VOICES[gender] ?? STOCK_VOICES["neutral"]!;
}

/** Maps our 2-letter UI codes to the ISO-639-3 codes Scribe expects. */
const ISO3: Record<string, string> = {
  en: "eng",
  es: "spa",
  fr: "fra",
  de: "deu",
  pt: "por",
  tr: "tur",
  ar: "ara",
  yo: "yor",
  ha: "hau",
  ig: "ibo",
};

export function toIso3(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  return ISO3[code.slice(0, 2).toLowerCase()];
}
