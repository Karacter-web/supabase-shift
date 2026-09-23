/**
 * Server-only translation. This is a deliberately separate step in the
 * speech-to-text -> translate -> speech pipeline: ElevenLabs does not do
 * cross-language translation, so DeepL (preferred) or an LLM handles it.
 */

const DEEPL_TARGETS: Record<string, string> = {
  en: "EN-US",
  es: "ES",
  fr: "FR",
  de: "DE",
  pt: "PT-BR",
  tr: "TR",
  ar: "AR",
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  tr: "Turkish",
  ar: "Arabic",
  yo: "Yoruba",
  ha: "Hausa",
  ig: "Igbo",
};

function languageName(code: string): string {
  return LANGUAGE_NAMES[code.slice(0, 2).toLowerCase()] ?? code;
}

async function translateWithDeepL(
  text: string,
  targetLang: string,
  sourceLang?: string,
): Promise<string> {
  const key = process.env["DEEPL_API_KEY"];
  const target = DEEPL_TARGETS[targetLang.slice(0, 2).toLowerCase()];
  // DeepL has no Yoruba/Hausa/Igbo — those fall through to the LLM.
  if (!key || !target) return "";

  const host = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  const body: Record<string, unknown> = { text: [text], target_lang: target };
  const source = sourceLang ? DEEPL_TARGETS[sourceLang.slice(0, 2).toLowerCase()] : undefined;
  if (source) body["source_lang"] = source.split("-")[0];

  try {
    const res = await fetch(`${host}/v2/translate`, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`DeepL translation failed [${res.status}]: ${await res.text()}`);
      return "";
    }
    const json = (await res.json()) as { translations?: Array<{ text?: string }> };
    return json.translations?.[0]?.text?.trim() ?? "";
  } catch (error) {
    console.error("DeepL translation error", error);
    return "";
  }
}

async function translateWithLlm(
  text: string,
  targetLang: string,
  sourceLang?: string,
): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return "";
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a live phone-call interpreter. Translate the user's message${
              sourceLang ? ` from ${languageName(sourceLang)}` : ""
            } into ${languageName(targetLang)}. Reply with the translation only, no notes or quotes.`,
          },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`LLM translation failed [${res.status}]: ${await res.text()}`);
      return "";
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (error) {
    console.error("LLM translation error", error);
    return "";
  }
}

/**
 * Translate text. Tries DeepL first, then the LLM gateway.
 * Returns '' when nothing could translate it, so callers can fall back to
 * the original text rather than dropping the line.
 */
export async function translateText(
  text: string,
  targetLang: string,
  sourceLang?: string,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (sourceLang && sourceLang.slice(0, 2) === targetLang.slice(0, 2)) return trimmed;

  const viaDeepL = await translateWithDeepL(trimmed, targetLang, sourceLang);
  if (viaDeepL) return viaDeepL;
  return translateWithLlm(trimmed, targetLang, sourceLang);
}
