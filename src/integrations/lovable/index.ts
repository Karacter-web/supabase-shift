import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { supabase } from "@/integrations/supabase/client";

const auth = createLovableAuth();

/**
 * Lovable auth broker wrapper. Google sign-in must go through this helper so
 * the editor preview (iframe) flow works; it stores the returned session on
 * the Supabase client.
 */
export const lovable = {
  auth: {
    async signInWithOAuth(
      provider: Parameters<typeof auth.signInWithOAuth>[0],
      opts?: Parameters<typeof auth.signInWithOAuth>[1],
    ) {
      const result = await auth.signInWithOAuth(provider, opts);
      if (result.tokens) {
        await supabase.auth.setSession({
          access_token: result.tokens.access_token,
          refresh_token: result.tokens.refresh_token,
        });
      }
      return result;
    },
  },
};
