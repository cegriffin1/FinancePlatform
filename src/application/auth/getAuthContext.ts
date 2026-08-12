import type { Session } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { hasSupabaseConfig } from "@/lib/env";

export type AuthContext = {
  session: Session | null;
  userId: string | null;
  configured: boolean;
};

export async function getAuthContext(): Promise<AuthContext> {
  if (!hasSupabaseConfig()) {
    return { session: null, userId: null, configured: false };
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return {
    session: data.session,
    userId: data.session?.user.id ?? null,
    configured: true,
  };
}
