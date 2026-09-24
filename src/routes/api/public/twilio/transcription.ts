import { createFileRoute } from "@tanstack/react-router";
import { readTwilioParams, translateText, verifyTwilioWebhook } from "@/lib/twilio.server";

/** Receives Twilio real-time transcription events and stores them for Call Studio. */
export const Route = createFileRoute("/api/public/twilio/transcription")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const params = await readTwilioParams(request);
        if (!verifyTwilioWebhook(request, params)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const callSid = params.get("CallSid");
        const event = params.get("TranscriptionEvent");
        if (!callSid) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: session } = await supabaseAdmin
          .from("call_sessions")
          .select("id, user_id, source_lang, target_lang")
          .eq("call_sid", callSid)
          .maybeSingle();
        if (!session) return new Response("ok");

        if (event === "transcription-stopped") {
          return new Response("ok");
        }
        if (event !== "transcription-content") return new Response("ok");

        let transcript = "";
        try {
          const raw = params.get("TranscriptionData");
          if (raw) transcript = (JSON.parse(raw) as { transcript?: string }).transcript ?? "";
        } catch {
          transcript = params.get("TranscriptionData") ?? "";
        }
        transcript = transcript.trim();
        if (!transcript) return new Response("ok");

        const isFinal = params.get("Final") === "true";
        const sequence = Number(params.get("SequenceId") ?? 0) || 0;
        const speaker = params.get("Track") === "outbound_track" ? "agent" : "caller";

        const translated = isFinal
          ? await translateText(transcript, session.target_lang, session.source_lang)
          : null;

        await supabaseAdmin.from("call_transcripts").insert({
          session_id: session.id,
          user_id: session.user_id,
          speaker,
          text: transcript,
          translated_text: translated,
          is_final: isFinal,
          sequence,
        });

        return new Response("ok");
      },
    },
  },
});
