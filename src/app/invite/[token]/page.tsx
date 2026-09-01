import Link from "next/link";
import { redirect } from "next/navigation";

import { getInvitePreviewAction, redeemInviteAction } from "@/actions/invite";
import { InvitePreviewBanner } from "@/components/invite-preview-banner";
import { getAppUser } from "@/lib/auth";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export default async function InviteTokenPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  const user = await getAppUser();

  if (user?.coupleId) {
    redirect("/dashboard");
  }

  if (!user) {
    // Anonymous: show safe preview then continue to register
    const preview = await getInvitePreviewAction(token);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#070305] text-slate-100 px-4">
        <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-white font-display">
          MadLove
        </h1>
        {preview.ok ? (
          <InvitePreviewBanner token={token} />
        ) : (
          <p className="mb-6 text-sm text-amber-200/80 text-center max-w-sm">
            {preview.error.message}
          </p>
        )}
        <Link
          href={`/register?token=${encodeURIComponent(token)}`}
          className="rounded-full bg-gradient-to-r from-rose-400 via-pink-300 to-amber-200 px-6 py-3 text-sm font-bold text-slate-950"
        >
          Continue to join
        </Link>
        <p className="mt-4 text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
            className="text-rose-400 font-semibold"
          >
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  if (!user.isOnboarded) {
    await redis.set(`pending-invite:${user.id}`, token, { ex: 60 * 60 * 24 });
    redirect("/onboarding");
  }

  const result = await redeemInviteAction(token);
  if (result.ok) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 bg-[#070305] text-slate-100">
      <h1 className="mb-4 text-3xl font-semibold">MadLove invite</h1>
      <p className="mb-2 text-sm text-red-400">{result.error.message}</p>
      <p className="mb-6 text-sm text-slate-500">
        This invite could not be used. You can generate your own link or try again later.
      </p>
      <Link href="/invite" className="rounded-xl bg-rose-900 px-4 py-2 text-white">
        Go to invite
      </Link>
    </div>
  );
}
