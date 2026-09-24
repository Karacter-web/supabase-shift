/**
 * Server-only helpers for calling Twilio's REST API directly (no Lovable
 * gateway, no LOVABLE_API_KEY). Never import this from client code.
 *
 * Required env:
 *   TWILIO_ACCOUNT_SID  - "AC..." from the Twilio Console
 *   TWILIO_AUTH_TOKEN   - account auth token (also used to verify webhooks)
 * Optional env:
 *   TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET - use a restricted API key for
 *     REST calls instead of the auth token
 *   TWILIO_WEBHOOK_TOKEN - extra shared token appended as ?t= to webhook URLs
 *   PUBLIC_BASE_URL      - deployed https origin used for webhook URLs
 */
import { createHmac, timingSafeEqual } from "crypto";

const TWILIO_API = "https://api.twilio.com/2010-04-01";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not configured. Add it in Lovable (Cloud → Secrets) and in Vercel (Settings → Environment Variables) for every environment.`,
    );
  }
  return value;
}

export function twilioHeaders() {
  const accountSid = requireEnv("TWILIO_ACCOUNT_SID");
  const keySid = process.env["TWILIO_API_KEY_SID"];
  const keySecret = process.env["TWILIO_API_KEY_SECRET"];
  const user = keySid && keySecret ? keySid : accountSid;
  const pass = keySid && keySecret ? keySecret : requireEnv("TWILIO_AUTH_TOKEN");
  return { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` };
}

/**
 * Call a Twilio REST endpoint. `path` is relative to the account, e.g.
 * "/Messages.json". Body is form-encoded, as Twilio requires.
 */
export async function twilioRequest<T = unknown>(
  path: string,
  options: { method?: "GET" | "POST" | "DELETE"; form?: Record<string, string>; query?: Record<string, string> } = {},
): Promise<T> {
  const { method = "GET", form, query } = options;
  const accountSid = requireEnv("TWILIO_ACCOUNT_SID");
  const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
  const response = await fetch(`${TWILIO_API}/Accounts/${accountSid}${path}${qs}`, {
    method,
    headers: {
      ...twilioHeaders(),
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(form ? { body: new URLSearchParams(form).toString() } : {}),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Twilio request failed [${response.status}] ${path}: ${errorBody}`);
    throw new Error(`Twilio request failed [${response.status}]: ${errorBody}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Public base URL Twilio should call back on. */
export function publicBaseUrl(): string {
  return (process.env["PUBLIC_BASE_URL"] ?? "https://deep-call-flow.vercel.app").replace(/\/+$/, "");
}

/**
 * Shared token appended to webhook URLs. Optional when TWILIO_AUTH_TOKEN is
 * set (webhooks are then verified by Twilio's signature). Throws a clear
 * error only when neither protection is available.
 */
export function webhookToken(): string {
  const token = process.env["TWILIO_WEBHOOK_TOKEN"];
  if (token) return token;
  if (process.env["TWILIO_AUTH_TOKEN"]) return "";
  throw new Error(
    "Twilio webhooks cannot be secured: set TWILIO_AUTH_TOKEN (recommended) or TWILIO_WEBHOOK_TOKEN in every environment.",
  );
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function expectedSignature(authToken: string, url: string, params: URLSearchParams): string {
  const keys = [...new Set(params.keys())].sort();
  let data = url;
  for (const key of keys) for (const v of params.getAll(key)) data += key + v;
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

/**
 * Verify an incoming Twilio webhook. Accepts the request when either:
 *  - X-Twilio-Signature matches (needs TWILIO_AUTH_TOKEN), or
 *  - ?t= matches TWILIO_WEBHOOK_TOKEN.
 * `params` is the parsed form body (empty for GET).
 */
export function verifyTwilioWebhook(request: Request, params: URLSearchParams): boolean {
  const url = new URL(request.url);
  const shared = process.env["TWILIO_WEBHOOK_TOKEN"];
  const provided = url.searchParams.get("t");
  if (shared && provided && safeEqual(provided, shared)) return true;

  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  const signature = request.headers.get("x-twilio-signature");
  if (!authToken || !signature) return false;

  const bodyParams = request.method === "GET" ? new URLSearchParams() : params;
  const pathAndQuery = `${url.pathname}${url.search}`;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const candidates = new Set([
    request.url,
    `${publicBaseUrl()}${pathAndQuery}`,
    ...(forwardedHost ? [`https://${forwardedHost}${pathAndQuery}`] : []),
    `https://${url.host}${pathAndQuery}`,
  ]);
  for (const candidate of candidates) {
    if (safeEqual(expectedSignature(authToken, candidate, bodyParams), signature)) return true;
  }
  return false;
}

/** Helper for routes: read form params (POST body or query) once. */
export async function readTwilioParams(request: Request): Promise<URLSearchParams> {
  if (request.method === "GET") return new URL(request.url).searchParams;
  try {
    return new URLSearchParams(await request.text());
  } catch {
    return new URLSearchParams();
  }
}

/**
 * Translation for the call path. The implementation lives in
 * translate.server.ts (DeepL first, LLM fallback) and is re-exported here so
 * existing callers keep working.
 */
export { translateText } from "./translate.server";

const SAY_LOCALES: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
  ar: "ar-XA",
  yo: "en-US",
  ha: "en-US",
  ig: "en-US",
};

export function sayLocale(lang: string): string {
  return SAY_LOCALES[lang] ?? "en-US";
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
