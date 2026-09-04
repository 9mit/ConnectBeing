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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050409] text-slate-100 px-4 py-12 relative overflow-hidden">
      {/* Restrained luxury ambient glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] rounded-full blur-[120px] opacity-[0.10] bg-rose-500 pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] rounded-full blur-[130px] opacity-[0.08] bg-sky-500 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-md">
        <Link href="/" className="group flex flex-col items-center mb-6" aria-label="MadLove home">
          <span className="font-serif text-4xl md:text-5xl font-light tracking-[0.04em] text-[#fbf9f4] group-hover:text-white transition-colors">
            MadLove
          </span>
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-400 font-light mt-1.5">
            Sanctuary for Two
          </span>
        </Link>
        {!token ? (
          <p className="mb-6 text-xs text-zinc-400 font-sans tracking-wide text-center max-w-xs leading-relaxed">
            Begin your private digital home. Strictly for you and your partner.
          </p>
        ) : (
          <InvitePreviewBanner token={token} />
        )}

        {/* Card Container */}
        <div className="w-full p-8 md:p-9 rounded-3xl border border-white/10 bg-[#0d0918]/80 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.8)]">
          <AuthForm mode="register" inviteToken={token} />
        </div>

        <p className="mt-6 text-xs text-zinc-400 font-sans text-center">
          Already have an account?{" "}
          <Link
            href={token ? `/login?next=${encodeURIComponent(`/invite/${token}`)}` : "/login"}
            className="text-[#fbf9f4] hover:text-sky-300 font-medium transition-colors"
          >
            Enter sanctuary →
          </Link>
        </p>
      </div>
    </div>
  );
}

