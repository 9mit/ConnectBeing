import Link from "next/link";

import {
  verificationDueSoon,
  verificationExpired,
} from "@/lib/couple-verification";
import type { Couple } from "@/db/schema";

export function VerificationBanner({ couple }: { couple: Couple }) {
  const expired = verificationExpired(couple);
  const dueSoon = verificationDueSoon(couple, 48);

  if (!expired && !dueSoon) return null;

  return (
    <div
      className={`mb-6 rounded-2xl border px-5 py-4 text-sm backdrop-blur-md shadow-lg ${
        expired
          ? "border-red-500/40 bg-red-950/60 text-red-200 shadow-red-950/50"
          : "border-amber-500/40 bg-purple-950/70 text-amber-100 shadow-[0_0_15px_rgba(212,175,55,0.15)]"
      }`}
    >
      {expired ? (
        <p>
          Weekly verification expired. Shared chat, calls, and Together are
          locked until you{" "}
          <Link href="/verify" className="underline underline-offset-4 font-semibold text-amber-300 hover:text-amber-100">
            verify
          </Link>
          .
        </p>
      ) : (
        <p>
          Weekly verification is due soon.{" "}
          <Link href="/verify" className="underline underline-offset-4 font-semibold text-amber-300 hover:text-amber-100">
            Open /verify
          </Link>{" "}
          to stay unlocked.
        </p>
      )}
    </div>
  );
}
