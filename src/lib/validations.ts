import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.")
  .max(320, "Email is too long.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  inviteToken: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "Invalid invite token")
    .optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z.object({
  password: passwordSchema,
});

export const onboardingSchema = z.object({
  name: z.string().trim().min(1).max(80),
  age: z.coerce.number().int().min(18).max(120),
  gender: z.string().trim().min(1).max(40),
  hobbies: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
  selfDescription: z.string().trim().min(1).max(500),
  partnerExpectation: z.string().trim().min(1).max(500),
  loveLanguages: z.array(z.string().trim().min(1).max(40)).min(1).max(5),
});

export const sendMessageSchema = z.object({
  // Client must encrypt; server stores ciphertext only
  content: z
    .string()
    .trim()
    .min(1)
    .max(8000)
    .regex(/^e2ee:v1:/, "Messages must be end-to-end encrypted."),
  clientMsgId: z.string().trim().min(8).max(64).optional(),
});

export const submitVerificationCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9A-HJKMNP-TV-Z]{8}$/, "Enter the 8-character code"),
});

export const moodSchema = z.object({
  mood: z.enum(["happy", "cuddles", "space", "excited", "low"]),
  note: z.string().trim().max(200).optional(),
});

export const renamePetSchema = z.object({
  petName: z.string().trim().min(1).max(40),
});

export const quizAnswerSchema = z.object({
  questionSetId: z.string().min(1),
  answers: z.array(z.string().min(1)).min(1).max(3),
});

export const memoryMetaSchema = z.object({
  storageKey: z.string().min(1).max(500),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  caption: z.string().trim().max(300).optional(),
  takenAt: z.string().datetime(),
  eventLabel: z.string().trim().max(80).optional(),
});

export const ephemeralConfirmSchema = z.object({
  storageKey: z.string().min(1).max(500),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export const viewEphemeralSchema = z.object({
  mediaId: z.string().min(1),
});

export const quizQuestionSchema = z.object({
  index: z.number().int().min(0).max(2),
  question: z.string().min(1),
  correct_answer: z.string().min(1),
  distractors: z.array(z.string().min(1)).length(3),
});

export const quizArraySchema = z.array(quizQuestionSchema).length(3);

export const personaSchema = z.object({
  archetype: z.enum(["challenge", "nurture", "adventure"]),
  strengths: z.array(z.string()).min(1).max(5),
  growth_areas: z.array(z.string()).min(1).max(5),
  suggested_theme: z.enum(["rose", "violet", "amber", "sky"]),
  daily_task_style: z.enum(["challenge", "nurture", "adventure"]),
});

export const createWatchSessionSchema = z.object({
  provider: z.enum([
    "netflix",
    "prime",
    "disney",
    "apple",
    "jiohotstar",
    "sonyliv",
    "zee5",
    "crunchyroll",
    "youtube",
    "other",
  ]),
  title: z.string().trim().min(1).max(100),
  posterUrl: z.string().url().optional().or(z.literal("")),
  scheduledFor: z.string().datetime().optional(), // ISO string
  invitationMessage: z.string().trim().max(300).optional(),
  theme: z.string().trim().max(50).optional(),
});

export const watchSessionMessageSchema = z.object({
  sessionId: z.string().min(1),
  content: z.string().trim().min(1).max(1000),
  playbackPosition: z.number().int().min(0).optional(),
});

export const watchEventSchema = z.object({
  sessionId: z.string().min(1),
  eventType: z.enum(["play", "pause", "seek"]),
  playbackPosition: z.number().min(0), // Can be float for precise sync
});
