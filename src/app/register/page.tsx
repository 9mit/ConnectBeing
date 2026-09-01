import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { InvitePreviewBanner } from "@/components/invite-preview-banner";

export const metadata = {
  title: "Create Account — MadLove",
  description: "Create your private space together on MadLove.",
};

export default function RegisterPage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#070305] text-slate-100 px-4 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] opacity-[0.15] bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full blur-[100px] opacity-[0.08] bg-purple-500 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-md">
        <Link href="/" className="group flex flex-col items-center mb-2">
          <h1 className="text-5xl font-extrabold tracking-tight text-white font-display select-none group-hover:text-rose-100 transition-colors">
            MadLove
          </h1>
          <span className="text-[10px] uppercase tracking-[0.3em] text-rose-400/80 font-bold mt-1">
            universe for two
          </span>
        </Link>
        {!token ? (
          <p className="mb-8 text-sm text-slate-400 font-medium tracking-wide text-center max-w-xs leading-relaxed">
            Create your private space together
          </p>
        ) : (
          <InvitePreviewBanner token={token} />
        )}

        <AuthForm mode="register" inviteToken={token} />

        <p className="mt-6 text-sm text-slate-400 font-medium text-center">
          Already have an account?{" "}
          <Link
            href={token ? `/login?next=${encodeURIComponent(`/invite/${token}`)}` : "/login"}
            className="text-rose-400 hover:text-rose-300 font-semibold transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

