import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { watchSessions } from "@/db/schema";
import { getRoomCustomizationAction } from "@/actions/room";
import { AppShell } from "@/components/app-shell";
import { redirectPathForAuthError, requireActiveCouple } from "@/lib/auth";
import { getProvider } from "@/features/together/providers";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: BRAND.formatTitle("Virtual Theater Room"),
  description: "Synchronized playback, shared reactions, and voice connection for two.",
};

const VirtualRoom = nextDynamic(
  () =>
    import("@/components/together/VirtualRoom").then((m) => m.VirtualRoom),
  { ssr: false },
);

export default async function RoomPage({
  params,
}: {
  params: { sessionId: string };
}) {
  let user, couple;
  try {
    const auth = await requireActiveCouple();
    user = auth.user;
    couple = auth.couple;
  } catch (error) {
    redirect(redirectPathForAuthError(error));
  }

  const session = await db.query.watchSessions.findFirst({
    where: and(
      eq(watchSessions.id, params.sessionId),
      eq(watchSessions.coupleId, couple.id),
    ),
  });

  if (!session) {
    redirect("/together");
  }

  const provider = getProvider(session.provider);
  const providerName = provider ? provider.name : session.provider;
  const partnerId = couple.userAId === user.id ? couple.userBId : couple.userAId;
  const room = await getRoomCustomizationAction();
  const theme = room.ok ? room.data.theme : "rose-dusk";
  const decor = room.ok ? room.data.decor : {};

  const isNetworkStream = session.hostStreamType?.startsWith("network:");
  const initialDirectMediaUrl = isNetworkStream ? session.hostStreamType!.slice(8) : null;
  const initialDirectMediaTitle = isNetworkStream ? (session.invitationMessage || "Network Stream") : null;

  return (
    <AppShell coupleId={couple.id} userId={user.id} isTheater={true}>
      <div className="h-full w-full overflow-hidden">
        <VirtualRoom
          sessionId={session.id}
          userId={user.id}
          partnerId={partnerId}
          coupleId={couple.id}
          providerName={providerName}
          title={session.title}
          posterUrl={session.posterUrl}
          isHost={session.hostUserId ? session.hostUserId === user.id : couple.userAId === user.id}
          initialHostStreamActive={!!session.hostStreamActive}
          initialPlaybackState={session.playbackState || "idle"}
          initialPosition={session.currentPosition || 0}
          initialDirectMediaUrl={initialDirectMediaUrl}
          initialDirectMediaTitle={initialDirectMediaTitle}
          theme={theme}
          decor={decor}
        />
      </div>
    </AppShell>
  );
}
