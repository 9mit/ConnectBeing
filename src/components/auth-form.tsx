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
  "w-full rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3 text-sm text-[#fbf9f4] placeholder-zinc-500 focus:outline-none focus:border-sky-400/60 focus:bg-white/[0.06] transition-all";

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
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          const message =
            typeof data?.error === "string"
              ? data.error
              : data?.error?.message || "Authentication failed. Please check credentials.";
          setError(message);
          return;
        }

        // Seamless redirection (safely bounded to internal paths)
        const rawTarget = data?.redirectTo || data?.redirect || "/dashboard";
        const isSafeInternalUrl = (url: unknown): url is string => {
          if (
            typeof url !== "string" ||
            !url.startsWith("/") ||
            url.startsWith("//") ||
            url.startsWith("/\\") ||
            url.includes("\\")
          ) {
            return false;
          }
          try {
            return new URL(url, window.location.origin).origin === window.location.origin;
          } catch {
            return false;
          }
        };
        const target = isSafeInternalUrl(rawTarget) ? rawTarget : "/dashboard";
        window.location.href = target;
      } catch {
        setError("Network connection error. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="w-full space-y-5" noValidate>
      <div className="space-y-1.5">
        <label
          htmlFor="auth-email"
          className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-400 font-medium"
        >
          Email Address
        </label>
        <input
          id="auth-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="two-souls@soulnest.app"
          aria-invalid={!!fieldErrors.email}
          aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
          className={`${inputBase} ${
            fieldErrors.email
              ? "border-rose-500/70 focus:border-rose-400"
              : "border-white/10"
          }`}
        />
        {fieldErrors.email ? (
          <p id="auth-email-error" className="text-xs font-mono text-rose-300" role="alert">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="auth-password"
            className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-400 font-medium"
          >
            Password
          </label>
          {mode === "login" && (
            <Link
              href="/forgot-password"
              className="text-[11px] font-sans text-zinc-400 hover:text-white transition-colors"
            >
              Forgot Password?
            </Link>
          )}
        </div>
        <input
          id="auth-password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder="••••••••"
          aria-invalid={!!fieldErrors.password}
          aria-describedby={
            fieldErrors.password ? "auth-password-error" : undefined
          }
          className={`${inputBase} ${
            fieldErrors.password
              ? "border-rose-500/70 focus:border-rose-400"
              : "border-white/10"
          }`}
        />
        {fieldErrors.password ? (
          <p
            id="auth-password-error"
            className="text-xs font-mono text-rose-300"
            role="alert"
          >
            {fieldErrors.password}
          </p>
        ) : null}
      </div>

      {error ? (
        <div
          className="text-xs font-sans text-rose-200 bg-rose-500/10 border border-rose-500/25 px-4 py-2.5 rounded-xl text-center"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-[#fbf9f4] text-[#0c0d0e] py-3.5 text-xs font-bold uppercase tracking-[0.14em] hover:bg-white hover:shadow-[0_4px_20px_rgba(251,249,244,0.2)] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
      >
        {pending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-3.5 w-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            <span>Connecting to Sanctuary…</span>
          </span>
        ) : mode === "login" ? (
          "Enter Sanctuary"
        ) : (
          "Create Private Account"
        )}
      </button>
    </form>
  );
}
