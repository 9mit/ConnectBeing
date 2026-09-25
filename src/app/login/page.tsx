import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getAppUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: BRAND.formatTitle("Sign In"),
  description: "Sign in to your private space for two.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string; registered?: string; error?: string; logout?: string; force?: string };
}) {
  const next = searchParams?.next;
  const registered = searchParams?.registered === "1";
  const errorParam = searchParams?.error;
  const hasOverrideParam = !!(next || registered || errorParam || searchParams?.logout || searchParams?.force);

  if (!hasOverrideParam) {
    const appUser = await getAppUser();
    if (appUser) {
      if (!appUser.isOnboarded) {
        redirect("/onboarding");
      }
      if (!appUser.coupleId) {
        redirect("/onboarding/decision");
      }
      redirect("/dashboard");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050409] text-slate-100 px-4 py-12 relative overflow-hidden">
      {/* Restrained luxury ambient glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] rounded-full blur-[120px] opacity-[0.10] bg-sky-500 pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] rounded-full blur-[130px] opacity-[0.08] bg-rose-500 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-md">
        {/* Brand */}
        <Link href="/" className="group flex flex-col items-center mb-6" aria-label={`${BRAND.name} home`}>
          <span className="font-serif text-4xl md:text-5xl font-light tracking-[0.04em] text-[#fbf9f4] group-hover:text-white transition-colors">
            {BRAND.name}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-400 font-light mt-1.5">
            Sanctuary for Two
          </span>
        </Link>

        {registered && (
          <div
            className="w-full mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs font-mono text-emerald-300 text-center"
            role="status"
          >
            ✦ Account created successfully. Please enter your sanctuary.
          </div>
        )}

        {errorParam === "auth_callback_failed" && (
          <div
            className="w-full mb-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs font-mono text-rose-300 text-center"
            role="alert"
          >
            Authentication link expired or invalid. Please sign in again.
          </div>
        )}

        {/* Card Container */}
        <div className="w-full p-8 md:p-9 rounded-3xl border border-white/10 bg-[#0d0918]/80 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.8)]">
          <AuthForm mode="login" initialNext={next} />
        </div>

        <p className="mt-6 text-xs text-zinc-400 font-sans text-center">
          First time here?{" "}
          <Link
            href="/register"
            className="text-[#fbf9f4] hover:text-sky-300 font-medium transition-colors"
          >
            Begin your story →
          </Link>
        </p>
      </div>
    </div>
  );
}


