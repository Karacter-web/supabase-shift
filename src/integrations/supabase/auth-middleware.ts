// src/integrations/supabase/auth-middleware.ts
import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Validates the bearer token attached to the server-function request and
 * exposes a Supabase client that acts as that user (RLS applies).
 */
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const url = process.env["SUPABASE_URL"];
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !publishableKey) {
      throw new Error("Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY on the server.");
    }

    const authorization = getRequestHeader("authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const supabase = createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      throw new Response("Unauthorized", { status: 401 });
    }

    return next({
      context: {
        supabase,
        user: data.user,
        userId: data.user.id,
        accessToken,
      },
    });
  },
);
