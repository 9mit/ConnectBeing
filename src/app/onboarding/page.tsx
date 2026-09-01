import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding-form";
import { getAppUser, redirectPathForAuthError } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getAppUser();
  if (!user) {
    redirect(redirectPathForAuthError(new AppError("UNAUTHORIZED", "Sign in required.", 401)));
  }
  if (user.isOnboarded && user.coupleId) {
    redirect("/dashboard");
  }
  if (user.isOnboarded && !user.coupleId) {
    redirect("/invite");
  }

  return (
    <div className="min-h-screen bg-[#070305] text-slate-100 px-4 py-16 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-10 bg-gradient-to-br from-rose-500 via-pink-500 to-purple-500 pointer-events-none" />

      <div className="mx-auto max-w-2xl relative z-10 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white font-display select-none">
            Welcome to MadLove
          </h1>
          <p className="mt-3 text-sm text-slate-400 font-medium max-w-md mx-auto">
            Tell us about yourself to tailor your shared dashboard and connection suggestions.
          </p>
        </div>
        
        <OnboardingForm />
      </div>
    </div>
  );
}
