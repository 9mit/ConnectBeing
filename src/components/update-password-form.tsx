"use client";

import { useState, useTransition } from "react";

import { updatePasswordAction } from "@/actions/auth";
import { updatePasswordSchema } from "@/lib/validations";

export function UpdatePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const parsed = updatePasswordSchema.safeParse({ password });

    if (!parsed.success) {
      const msg =
        parsed.error.flatten().fieldErrors.password?.[0] ??
        "Password must be at least 8 characters.";
      setFieldError(msg);
      setError(msg);
      return;
    }

    startTransition(async () => {
      const result = await updatePasswordAction({
        password: parsed.data.password,
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      window.location.href = result.data.redirectTo;
    });
  }

  return (
    <div className="mx-auto w-full max-w-md p-8">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Update Password
        </h1>
        <p className="text-sm text-slate-400">Enter your new password below.</p>
      </div>

      <form noValidate onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <label
            htmlFor="auth-password"
            className="text-xs font-semibold uppercase tracking-wider text-slate-400"
          >
            New Password
          </label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            aria-invalid={!!fieldError}
            aria-describedby={fieldError ? "update-password-error" : undefined}
            className={`w-full rounded-2xl bg-white/[0.06] px-5 py-3.5 text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:bg-white/[0.08] transition-all border ${
              fieldError ? "border-rose-500/60" : "border-white/[0.08]"
            }`}
          />
          {fieldError ? (
            <p
              id="update-password-error"
              className="text-xs font-medium text-rose-300"
              role="alert"
            >
              {fieldError}
            </p>
          ) : null}
        </div>

        {error && !fieldError ? (
          <p
            className="text-xs font-semibold text-rose-300 bg-rose-500/10 px-4 py-2.5 rounded-2xl text-center"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 py-3.5 text-sm font-bold text-white hover:from-rose-600 hover:to-pink-700 disabled:opacity-60 transition-all shadow-lg shadow-rose-500/20 hover:shadow-rose-500/30 hover:scale-[1.01] active:scale-[0.99]"
        >
          {pending ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}
