import { z } from "zod";

import { AppError, type AppErrorCode } from "@/lib/errors";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: AppErrorCode | string; message: string } };

export function ok<T = void>(data?: T): ActionResult<T> {
  return { ok: true, data: data as T };
}

export function err(code: AppErrorCode | string, message: string): ActionResult<never> {
  return { ok: false, error: { code, message } };
}

export function fail(error: unknown): ActionResult<never> {
  if (error instanceof AppError) {
    return {
      ok: false,
      error: { code: error.code, message: error.message },
    };
  }

  if (error instanceof z.ZodError) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error.issues[0]?.message || "Invalid request parameters.",
      },
    };
  }

  const msg = error instanceof Error ? error.message : String(error);
  if (
    /DATABASE_URL|ENOTFOUND|ECONNREFUSED|pooler|connect_timeout|getaddrinfo/i.test(
      msg,
    )
  ) {
    console.error("[action] database unavailable");
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Database is temporarily unavailable. Please try again shortly.",
      },
    };
  }

  console.error("[action]", error instanceof Error ? error.name : "unknown");
  return {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong. Please try again.",
    },
  };
}
