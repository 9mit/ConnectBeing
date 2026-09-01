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
        message:
          "Database is temporarily unavailable. Check DATABASE_URL uses the Supabase pooler.",
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
