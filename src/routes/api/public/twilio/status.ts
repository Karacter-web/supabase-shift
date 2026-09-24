import { createFileRoute } from "@tanstack/react-router";
import { readTwilioParams, verifyTwilioWebhook } from "@/lib/twilio.server";

/** Twilio call status callback: keeps call_sessions in sync. */
export const Route = createFileRoute("/api/public/twilio/status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const params = await readTwilioParams(request);
        if (!verifyTwilioWebhook(request, params)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const callSid = params.get("CallSid");
        const callStatus = params.get("CallStatus") ?? "completed";
        const ended = ["completed", "busy", "failed", "no-answer", "canceled"].includes(callStatus);
        const durationValue = params.get("CallDuration") ?? params.get("Duration");
        const duration = durationValue ? Number(durationValue) : null;
        const providerError = params.get("ErrorMessage") ?? params.get("ErrorCode");

        if (callSid) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("call_sessions")
            .update({
              status: ended ? "ended" : callStatus,
              ...(ended ? { ended_at: new Date().toISOString() } : {}),
              ...(duration !== null && Number.isFinite(duration)
                ? { duration_seconds: duration }
                : {}),
              ...(providerError ? { provider_error: providerError } : {}),
            })
            .eq("call_sid", callSid);
        }

        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
          { headers: { "Content-Type": "application/xml" } },
        );
      },
    },
  },
});
