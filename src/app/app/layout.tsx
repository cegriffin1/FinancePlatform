import type { PropsWithChildren } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { getAuthContext } from "@/application/auth/getAuthContext";

export default async function AppLayout({ children }: PropsWithChildren) {
  const auth = await getAuthContext();
  const userLabel = auth.userId
    ? `Authenticated · ${auth.userId.slice(0, 8)}…`
    : auth.configured
      ? "Not signed in"
      : "Local shell · Supabase not configured";

  return (
    <AppShell orgName="Demo Organization" userLabel={userLabel}>
      {children}
    </AppShell>
  );
}
