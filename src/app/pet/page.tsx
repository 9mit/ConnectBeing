import { getPetStateAction } from "@/actions/pet";
import { AppShell } from "@/components/app-shell";
import { DigitalPet } from "@/components/digital-pet";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Digital Companion — MadLove",
  description: "Your shared companion that evolves with your couple connection rituals.",
};

export default async function PetPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();
  const res = await getPetStateAction();
  const initialPet = res.ok ? res.data : undefined;

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <DigitalPet initialPet={initialPet} />
    </AppShell>
  );
}
