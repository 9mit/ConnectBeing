import { getDailyQuizAction } from "@/actions/quiz";
import { AppShell } from "@/components/app-shell";
import { QuizPanel } from "@/components/quiz-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: BRAND.formatTitle("Daily Quiz"),
  description: "Daily couple connection questions and answer reveals.",
};

export default async function QuizPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();
  const initialQuiz = await getDailyQuizAction();

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <QuizPanel initialQuiz={initialQuiz} />
    </AppShell>
  );
}
