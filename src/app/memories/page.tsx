import { AppShell } from "@/components/app-shell";
import { MemoriesGallery } from "@/components/memories-gallery";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: BRAND.formatTitle("Memories & Moments"),
  description: "Preserve your relationship milestones and favorite photo moments.",
};

export default async function MemoriesPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="mb-6">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400">
            Vault of Us
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white font-display mt-1 text-glow-gold">
            Relationship Memories
          </h1>
          <p className="mt-2 text-sm text-slate-300 font-medium">
            Preserve your milestones, favorite photo moments, and movie night watch histories.
          </p>
        </header>
        <MemoriesGallery />
      </div>
    </AppShell>
  );
}
