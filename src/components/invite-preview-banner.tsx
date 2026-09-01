"use client";

import { useEffect, useState } from "react";

import { getInvitePreviewAction } from "@/actions/invite";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function InvitePreviewBanner({ token }: { token: string }) {
  const [preview, setPreview] = useState<{
    displayName: string;
    avatarUrl: string | null;
    brandMessage: string;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getInvitePreviewAction(token).then((res) => {
      if (cancelled) return;
      if (res.ok) setPreview(res.data);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (failed) {
    return (
      <p className="mb-6 text-sm text-amber-200/80 text-center">
        This invite link may be invalid or expired. You can still create an account.
      </p>
    );
  }

  if (!preview) {
    return (
      <p className="mb-6 text-sm text-slate-500 text-center animate-pulse">
        Looking up your invitation…
      </p>
    );
  }

  return (
    <div className="mb-8 flex flex-col items-center gap-3 text-center">
      {preview.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.avatarUrl}
          alt=""
          className="h-16 w-16 rounded-full object-cover border border-amber-500/40 shadow-[0_0_15px_rgba(212,175,55,0.3)]"
        />
      ) : (
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-purple-700 border border-amber-400/50 text-lg font-bold text-amber-100 shadow-[0_0_20px_rgba(212,175,55,0.3)]"
          aria-hidden
        >
          {initials(preview.displayName)}
        </div>
      )}
      <p className="text-sm text-slate-300 leading-relaxed max-w-xs">
        You have been invited by{" "}
        <span className="font-semibold text-amber-300 text-glow-gold">{preview.displayName}</span>{" "}
        to join MadLove.
      </p>
    </div>
  );
}
