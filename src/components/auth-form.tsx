"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { loginSchema, registerSchema } from "@/lib/validations";

type FieldErrors = {
  email?: string;
  password?: string;
};

function zodFieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}): FieldErrors {
  const flat = error.flatten().fieldErrors;
  return {
    email: flat.email?.[0],
    password: flat.password?.[0],
  };
}

const inputBase =
  "w-full rounded-2xl bg-purple-950/40 px-5 py-3.5 text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-purple-900/60 transition-all";

export function AuthForm({
  mode,
  inviteToken,
  initialNext,
}: {
  mode: "login" | "register";
  inviteToken?: string;
  initialNext?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");

    const parsed =
      mode === "login"
        ? loginSchema.safeParse({ email, password })
        : registerSchema.safeParse({ email, password, inviteToken });

    if (!parsed.success) {
      const fields = zodFieldErrors(parsed.error);
      setFieldErrors(fields);
      setError(
        fields.email ||
          fields.password ||
          "Please fix the highlighted fields and try again.",
      );
      return;
    }

    startTransition(async () => {
      try {
        const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
        const payload =
          mode === "login"
            ? {
                email: parsed.data.email,
                password: parsed.data.password,
                next: initialNext,
              }
            : {
                email: parsed.data.email,
                password: parsed.data.password,
                inviteToken,
              };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          setError(
            data?.error?.message ||
              "An error occurred during authentication. Please try again.",
          );
          return;
        }

        if (data.redirectTo) {
          window.location.href = data.redirectTo;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Network error during authentication. Try again.";
        setError(msg);
      }
    });
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-md space-y-5 p-6 md:p-8 rounded-3xl bg-purple-950/50 border border-amber-500/30 backdrop-blur-2xl shadow-[0_0_35px_rgba(212,175,55,0.15)]"
    >
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
          aria-invalid={!!fieldErrors.email}
          aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
          className={`${inputBase} border ${
            fieldErrors.email
              ? "border-red-500/70 focus:border-red-500"
              : "border-amber-500/20 focus:border-amber-400"
          }`}
        />
        {fieldErrors.email ? (
          <p id="auth-email-error" className="text-xs font-medium text-amber-300" role="alert">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="auth-password"
          className="text-xs font-semibold uppercase tracking-wider text-amber-300/90"
        >
          Password
        </label>
        <input
          id="auth-password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder="At least 8 characters"
          aria-invalid={!!fieldErrors.password}
          aria-describedby={
            fieldErrors.password ? "auth-password-error" : undefined
          }
          className={`${inputBase} border ${
            fieldErrors.password
              ? "border-red-500/70 focus:border-red-500"
              : "border-amber-500/20 focus:border-amber-400"
          }`}
        />
        {fieldErrors.password ? (
          <p
            id="auth-password-error"
            className="text-xs font-medium text-amber-300"
            role="alert"
          >
            {fieldErrors.password}
          </p>
        ) : null}
        {mode === "login" && (
          <div className="flex justify-end pt-1">
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-amber-300 hover:text-amber-100 transition-colors"
            >
              Forgot Password?
            </Link>
          </div>
        )}
      </div>

      {error ? (
        <p
          className="text-xs font-semibold text-amber-200 bg-purple-950/80 border border-amber-500/40 px-4 py-3 rounded-2xl text-center shadow-lg"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 py-3.5 text-sm font-extrabold text-purple-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-60 transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
      >
        {pending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 border-2 border-purple-950/30 border-t-purple-950 rounded-full animate-spin" />
            Processing…
          </span>
        ) : mode === "login" ? (
          "Sign In"
        ) : (
          "Create Account"
        )}
      </button>
    </form>
  );
}
