"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { forgotPasswordAction } from "@/actions/auth";
import { forgotPasswordSchema } from "@/lib/validations";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    setSuccess(null);

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const parsed = forgotPasswordSchema.safeParse({ email });

    if (!parsed.success) {
      const msg =
        parsed.error.flatten().fieldErrors.email?.[0] ??
        "Enter a valid email address.";
      setFieldError(msg);
      setError(msg);
      return;
    }

    startTransition(async () => {
      const result = await forgotPasswordAction({ email: parsed.data.email });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSuccess(result.data.message);
    });
  }

  return (
    <div className="mx-auto w-full max-w-md p-8 rounded-3xl bg-purple-950/50 border border-amber-500/30 backdrop-blur-2xl shadow-[0_0_35px_rgba(212,175,55,0.15)]">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white text-glow-gold font-display">
          Reset Password
        </h1>
        <p className="text-sm text-slate-300">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {success ? (
        <div className="rounded-2xl bg-amber-500/20 border border-amber-500/40 p-5 text-sm text-amber-200 text-center space-y-4 shadow-md">
          <p>{success}</p>
          <Link
            href="/login"
            className="inline-block text-xs font-semibold text-amber-300 hover:text-amber-100 transition-colors"
          >
            Return to Login
          </Link>
        </div>
      ) : (
        <form noValidate onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="auth-email"
              className="text-xs font-semibold uppercase tracking-wider text-amber-300/90"
            >
              Email Address
            </label>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="your@email.com"
              aria-invalid={!!fieldError}
              aria-describedby={fieldError ? "forgot-email-error" : undefined}
              className={`w-full rounded-2xl bg-purple-950/40 px-5 py-3.5 text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-purple-900/60 transition-all border ${
                fieldError
                  ? "border-red-500/70"
                  : "border-amber-500/20"
              }`}
            />
            {fieldError ? (
              <p
                id="forgot-email-error"
                className="text-xs font-medium text-amber-300"
                role="alert"
              >
                {fieldError}
              </p>
            ) : null}
          </div>

          {error && error !== fieldError ? (
            <p
              className="text-xs font-semibold text-amber-200 bg-purple-950/80 border border-amber-500/40 px-4 py-2.5 rounded-2xl text-center shadow-md"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 py-3.5 text-sm font-extrabold text-purple-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-60 transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:scale-[1.01] active:scale-[0.99]"
          >
            {pending ? "Sending link..." : "Send Reset Link"}
          </button>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-amber-300/80 hover:text-amber-100 transition-colors"
            >
              Back to Login
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
