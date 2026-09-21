import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { MatchmakingHub } from "@/components/matchmaking/MatchmakingHub";
import { getMatchmakingStatusAction } from "@/actions/matchmaking";
import { requireOnboardedUser, redirectPathForAuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MatchmakingPage() {
  let user;
  try {
    user = await requireOnboardedUser();
  } catch (error) {
    redirect(redirectPathForAuthError(error));
  }

  const statusRes = await getMatchmakingStatusAction();
  const initialStatus = statusRes.ok
    ? statusRes.data
    : {
        hasProfile: false,
        enabled: false,
        paused: false,
      };

  return (
    <AppShell coupleId={user.coupleId} userId={user.id}>
      <MatchmakingHub initialStatus={initialStatus} />
    </AppShell>
  );
}
