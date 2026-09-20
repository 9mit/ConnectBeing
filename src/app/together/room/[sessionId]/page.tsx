import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { watchSessions } from "@/db/schema";
import { getRoomCustomizationAction } from "@/actions/room";
import { AppShell } from "@/components/app-shell";
import { redirectPathForAuthError, requireActiveCouple } from "@/lib/auth";
import { getProvider } from "@/features/together/providers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Virtual Theater Room — MadLove Together",
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

  return (
    <AppShell coupleId={couple.id} userId={user.id}>
      <div className="-mx-4 -my-8 h-[calc(100dvh-7.5rem)] md:h-[calc(100dvh-4rem)]">
        <VirtualRoom
          sessionId={session.id}
          userId={user.id}
          partnerId={partnerId}
          coupleId={couple.id}
          providerName={providerName}
          title={session.title}
          theme={theme}
          decor={decor}
        />
      </div>
    </AppShell>
  );
}
