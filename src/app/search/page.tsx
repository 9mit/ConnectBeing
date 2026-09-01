import { AppShell } from "@/components/app-shell";
import { SearchPanel } from "@/components/search-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search — MadLove",
  description: "Search across memories, movie nights, calendar rituals, and time capsules.",
};

export default async function SearchPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <SearchPanel />
    </AppShell>
  );
}
