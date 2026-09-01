import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getAppUser } from "@/lib/auth";

export const metadata = {
  title: "Sign In — MadLove",
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
        redirect("/invite");
      }
      redirect("/dashboard");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#070305] text-slate-100 px-4 py-12 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] opacity-[0.15] bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full blur-[100px] opacity-[0.08] bg-purple-500 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-md">
        {/* Brand */}
        <Link href="/" className="group flex flex-col items-center mb-2">
          <h1 className="text-5xl font-extrabold tracking-tight text-white font-display select-none group-hover:text-rose-100 transition-colors">
            MadLove
          </h1>
          <span className="text-[10px] uppercase tracking-[0.3em] text-rose-400/80 font-bold mt-1">
            universe for two
          </span>
        </Link>
        <p className="mb-8 text-sm text-slate-400 font-medium tracking-wide text-center">
          Sign in to your private space
        </p>

        {registered && (
          <div
            className="w-full mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs font-semibold text-emerald-300 text-center"
            role="status"
          >
            ✨ Account created successfully! Please sign in below.
          </div>
        )}

        {errorParam === "auth_callback_failed" && (
          <div
            className="w-full mb-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs font-semibold text-rose-300 text-center"
            role="alert"
          >
            Authentication link expired or invalid. Please sign in again.
          </div>
        )}

        <AuthForm mode="login" initialNext={next} />

        <p className="mt-6 text-sm text-slate-400 font-medium text-center">
          New here?{" "}
          <Link
            href="/register"
            className="text-rose-400 hover:text-rose-300 font-semibold transition-colors"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}


