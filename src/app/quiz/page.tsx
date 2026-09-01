import { AppShell } from "@/components/app-shell";
import { QuizPanel } from "@/components/quiz-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Daily Quiz — MadLove",
  description: "Daily couple connection questions and answer reveals.",
};

export default async function QuizPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <QuizPanel />
    </AppShell>
  );
}
