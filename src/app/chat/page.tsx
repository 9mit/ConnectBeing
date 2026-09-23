import { AppShell } from "@/components/app-shell";
import { ChatPanel } from "@/components/chat-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: BRAND.formatTitle("Chat & Ephemeral Media"),
  description: "End-to-end encrypted private messaging and self-destructing media.",
};

export default async function ChatPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <ChatPanel coupleId={ctx.couple.id} userId={ctx.user.id} />
    </AppShell>
  );
}
