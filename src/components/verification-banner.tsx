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
      className={`mb-6 rounded-2xl border px-5 py-3.5 text-xs font-medium backdrop-blur-md ${
        expired
          ? "border-rose-500/30 bg-rose-500/[0.06] text-rose-200"
          : "border-amber-500/25 bg-amber-500/[0.05] text-amber-200/90"
      }`}
    >
      {expired ? (
        <p>
          Weekly verification expired for both partners. Shared chat, calls, and Together are
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
