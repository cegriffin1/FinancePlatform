import type { PropsWithChildren } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { getOrgAuthContext } from "@/application/auth/getOrgAuthContext";
import { createSupabaseServiceClient } from "@/infrastructure/supabase/admin";
import { isSupabaseDataMode } from "@/lib/dataMode";

async function resolveOrgName(
  organizationId: string | null,
): Promise<string> {
  if (!organizationId) return "Your organization";
  if (!isSupabaseDataMode()) return "Your organization";
  try {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle();
    const name = data?.name?.trim();
    return name || "Your organization";
  } catch {
    return "Your organization";
  }
}

export default async function AppLayout({ children }: PropsWithChildren) {
  const auth = await getOrgAuthContext();
  const userLabel = auth.userId
    ? `Authenticated · ${auth.userId.slice(0, 8)}…`
    : auth.configured
      ? "Not signed in"
      : "Local shell · Supabase not configured";
  const orgName = await resolveOrgName(auth.organizationId);

  return (
    <AppShell orgName={orgName} userLabel={userLabel}>
      {children}
    </AppShell>
  );
}
