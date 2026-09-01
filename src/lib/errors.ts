export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "ACCOUNT_LOCKED"
  | "INVITE_TOKEN_INVALID"
  | "INVITE_TOKEN_EXPIRED"
  | "INVITE_TOKEN_USED"
  | "INVITE_TOKEN_SELF"
  | "MODERATION_REJECTED"
  | "MODERATION_NOT_IMPLEMENTED"
  | "INTERNAL_ERROR"
  | "CONFLICT"
  | "VERIFICATION_REQUIRED";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: AppErrorCode,
    message: string,
    status = 400,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class NotImplementedError extends AppError {
  constructor(message: string, details?: unknown) {
    super("MODERATION_NOT_IMPLEMENTED", message, 501, details);
    this.name = "NotImplementedError";
  }
}
