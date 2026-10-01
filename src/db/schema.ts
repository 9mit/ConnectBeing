import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const streamingProviderEnum = pgEnum("streaming_provider", [
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
]);

export const watchSessionStatusEnum = pgEnum("watch_session_status", [
  "scheduled",
  "active",
  "completed",
  "cancelled",
  "paused",
  "ended_unfinished",
]);

export const watchEventTypeEnum = pgEnum("watch_event_type", [
  "play",
  "pause",
  "seek",
]);

export const coupleStatusEnum = pgEnum("couple_status", [
  "pending",
  "active",
  "dissolved",
]);

export const petStateEnum = pgEnum("pet_state", [
  "thriving",
  "happy",
  "neutral",
  "sad",
  "neglected",
]);

export const messageTypeEnum = pgEnum("message_type", [
  "text",
  "ephemeral_image",
  "mood_update",
  "system",
]);

export const messageDeliveryStatusEnum = pgEnum("message_delivery_status", [
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
]);

export const ephemeralMediaStatusEnum = pgEnum("ephemeral_media_status", [
  "pending",
  "delivered",
  "viewed",
  "deleted",
]);

export const moodValueEnum = pgEnum("mood_value", [
  "happy",
  "cuddles",
  "space",
  "excited",
  "low",
]);

export const archetypeEnum = pgEnum("archetype", [
  "challenge",
  "nurture",
  "adventure",
]);

export const themeTokenEnum = pgEnum("theme_token", [
  "rose",
  "violet",
  "amber",
  "sky",
]);

export const dailyTaskStyleEnum = pgEnum("daily_task_style", [
  "challenge",
  "nurture",
  "adventure",
]);

export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free",
  "premium",
]);

export const relationshipEventTypeEnum = pgEnum("relationship_event_type", [
  "message_sent",
  "mood_logged",
  "quiz_completed",
  "watch_started",
  "watch_ended",
  "call_started",
  "call_ended",
  "memory_added",
  "achievement_unlocked",
  "challenge_completed",
]);

export const matchmakingStatusEnum = pgEnum("matchmaking_status", [
  "active",
  "paused",
  "disabled",
]);

export const matchmakingActionEnum = pgEnum("matchmaking_action", [
  "interested",
  "passed",
  "saved_later",
  "blocked",
  "reported",
]);

export const connectionStatusEnum = pgEnum("connection_status", [
  "connected",
  "disconnected",
  "blocked",
]);

// ---------------------------------------------------------------------------
// users
// Passwords live exclusively in Supabase Auth — never duplicated here.
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    supabaseAuthId: text("supabase_auth_id").notNull().unique(),
    email: text("email").notNull().unique(),
    subscriptionTier: subscriptionTierEnum("subscription_tier")
      .notNull()
      .default("free"),
    razorpayCustomerId: text("razorpay_customer_id"),
    e2eePublicKey: text("e2ee_public_key"),
    coupleId: text("couple_id").references((): AnyPgColumn => couples.id, {
      onDelete: "set null",
    }),
    isOnboarded: boolean("is_onboarded").notNull().default(false),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("users_couple_id_idx").on(table.coupleId)],
);

// ---------------------------------------------------------------------------
// onboarding_profiles — sensitive personal data isolated from users
// ---------------------------------------------------------------------------

export const onboardingProfiles = pgTable("onboarding_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  countryCode: text("country_code").notNull().default("IN"),
  hobbies: text("hobbies").array().notNull().default([]),
  selfDescription: text("self_description").notNull(),
  partnerExpectation: text("partner_expectation").notNull(),
  loveLanguages: text("love_languages").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// invite_tokens — store SHA-256(token) only; raw token never persisted
// ---------------------------------------------------------------------------

export const inviteTokens = pgTable(
  "invite_tokens",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    coupleId: text("couple_id").references((): AnyPgColumn => couples.id, {
      onDelete: "cascade",
    }),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    used: boolean("used").notNull().default(false),
    usedById: text("used_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("invite_tokens_token_hash_uidx").on(table.tokenHash),
    index("invite_tokens_inviter_id_idx").on(table.inviterId),
    index("invite_tokens_couple_id_idx").on(table.coupleId),
    index("invite_tokens_status_idx").on(table.status),
  ],
);

// ---------------------------------------------------------------------------
// couples — central relational hub; all couple data scopes here
// ---------------------------------------------------------------------------

export const couples = pgTable(
  "couples",
  {
    id: text("id").primaryKey(),
    userAId: text("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    userBId: text("user_b_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    status: coupleStatusEnum("status").notNull().default("pending"),
    anniversaryDate: timestamp("anniversary_date", { withTimezone: true }),
    petName: text("pet_name").notNull().default("Buddy"),
    petState: petStateEnum("pet_state").notNull().default("neutral"),
    calibrationDay: integer("calibration_day").notNull().default(0),
    isCalibrated: boolean("is_calibrated").notNull().default(false),
    verifiedUntil: timestamp("verified_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dissolvedAt: timestamp("dissolved_at", { withTimezone: true }),
  },
  (table) => [
    index("couples_status_idx").on(table.status),
    index("couples_user_a_id_idx").on(table.userAId),
    index("couples_user_b_id_idx").on(table.userBId),
  ],
);

// ---------------------------------------------------------------------------
// couple_members — dedicated membership table; strictly 1 active couple per user
// ---------------------------------------------------------------------------

export const coupleMembers = pgTable(
  "couple_members",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("creator"),
    status: text("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("couple_members_active_user_uidx")
      .on(table.userId)
      .where(sql`status = 'active'`),
    uniqueIndex("couple_members_couple_user_uidx").on(
      table.coupleId,
      table.userId,
    ),
    index("couple_members_couple_id_idx").on(table.coupleId),
    index("couple_members_user_id_idx").on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// messages
// ---------------------------------------------------------------------------

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: messageTypeEnum("type").notNull().default("text"),
    content: text("content"),
    clientMsgId: text("client_msg_id"),
    deliveryStatus: messageDeliveryStatusEnum("delivery_status")
      .notNull()
      .default("sent"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    ephemeralMediaId: text("ephemeral_media_id").references(
      (): AnyPgColumn => ephemeralMedia.id,
      { onDelete: "set null" },
    ),
    read: boolean("read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("messages_couple_id_created_at_idx").on(
      table.coupleId,
      table.createdAt,
    ),
    uniqueIndex("messages_couple_client_msg_uidx").on(
      table.coupleId,
      table.clientMsgId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// ephemeral_media — view-once images; row remains as tombstone after delete
// ---------------------------------------------------------------------------

export const ephemeralMedia = pgTable(
  "ephemeral_media",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: text("storage_key"),
    mimeType: text("mime_type").notNull(),
    status: ephemeralMediaStatusEnum("status").notNull().default("pending"),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("ephemeral_media_status_idx").on(table.status)],
);

// ---------------------------------------------------------------------------
// memories — permanent gallery photos
// ---------------------------------------------------------------------------

export const memories = pgTable(
  "memories",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    uploaderId: text("uploader_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    caption: text("caption"),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull(),
    eventLabel: text("event_label"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("memories_couple_id_taken_at_idx").on(table.coupleId, table.takenAt),
  ],
);

// ---------------------------------------------------------------------------
// moods — append-only log; current mood = most recent row per user in couple
// ---------------------------------------------------------------------------

export const moods = pgTable(
  "moods",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mood: moodValueEnum("mood").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("moods_couple_id_user_id_idx").on(table.coupleId, table.userId),
  ],
);

// ---------------------------------------------------------------------------
// quiz_questions — one set per couple per calendar date
// ---------------------------------------------------------------------------

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    questions: jsonb("questions").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("quiz_questions_couple_id_date_uidx").on(
      table.coupleId,
      table.date,
    ),
  ],
);

// ---------------------------------------------------------------------------
// quiz_responses — one row per user per quiz session
// ---------------------------------------------------------------------------

export const quizResponses = pgTable(
  "quiz_responses",
  {
    id: text("id").primaryKey(),
    questionSetId: text("question_set_id")
      .notNull()
      .references(() => quizQuestions.id, { onDelete: "cascade" }),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    answers: jsonb("answers").notNull(),
    score: integer("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("quiz_responses_question_set_user_uidx").on(
      table.questionSetId,
      table.userId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// couple_stats — daily engagement; Redis score flushed nightly
// ---------------------------------------------------------------------------

export const coupleStats = pgTable(
  "couple_stats",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    messageCount: integer("message_count").notNull().default(0),
    audioMinutes: integer("audio_minutes").notNull().default(0),
    locationUptimeMinutes: integer("location_uptime_minutes")
      .notNull()
      .default(0),
    quizCompleted: boolean("quiz_completed").notNull().default(false),
    moodLogged: boolean("mood_logged").notNull().default(false),
    engagementScore: integer("engagement_score").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("couple_stats_couple_id_date_uidx").on(
      table.coupleId,
      table.date,
    ),
  ],
);

// ---------------------------------------------------------------------------
// ai_insights — Day 16 relationship persona (one per couple)
// ---------------------------------------------------------------------------

export const aiInsights = pgTable(
  "ai_insights",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .unique()
      .references(() => couples.id, { onDelete: "cascade" }),
    archetype: archetypeEnum("archetype").notNull(),
    strengths: text("strengths").array().notNull(),
    growthAreas: text("growth_areas").array().notNull(),
    suggestedTheme: themeTokenEnum("suggested_theme").notNull(),
    dailyTaskStyle: dailyTaskStyleEnum("daily_task_style").notNull(),
    rawResponse: jsonb("raw_response").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

// ---------------------------------------------------------------------------
// watch_sessions — MadLove Together movie nights
// ---------------------------------------------------------------------------

export const watchSessions = pgTable(
  "watch_sessions",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    provider: streamingProviderEnum("provider").notNull(),
    title: text("title").notNull(),
    posterUrl: text("poster_url"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    status: watchSessionStatusEnum("status").notNull().default("scheduled"),
    invitationMessage: text("invitation_message"),
    theme: text("theme"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    hostUserId: text("host_user_id").references(() => users.id, { onDelete: "set null" }),
    hostStreamActive: boolean("host_stream_active").default(false),
    hostStreamType: text("host_stream_type").default("none"),
    playbackState: text("playback_state").default("idle"),
    currentPosition: integer("current_position").default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("watch_sessions_couple_id_idx").on(table.coupleId)],
);

export const watchParticipants = pgTable("watch_participants", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => watchSessions.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
});

export const watchEvents = pgTable("watch_events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => watchSessions.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  eventType: watchEventTypeEnum("event_type").notNull(),
  playbackPosition: integer("playback_position").notNull(), // in seconds
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const watchMessages = pgTable("watch_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => watchSessions.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  playbackPosition: integer("playback_position"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const movieMemories = pgTable(
  "movie_memories",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .unique()
      .references(() => watchSessions.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    provider: text("provider"),
    posterUrl: text("poster_url"),
    watchDuration: integer("watch_duration").notNull(), // minutes
    date: timestamp("date", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("movie_memories_couple_expires_idx").on(table.coupleId, table.expiresAt),
  ],
);

// ---------------------------------------------------------------------------
// subscriptions — Razorpay state; updated only by webhooks
// ---------------------------------------------------------------------------

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  razorpaySubscriptionId: text("razorpay_subscription_id").notNull().unique(),
  razorpayPlanId: text("razorpay_plan_id").notNull(),
  tier: subscriptionTierEnum("tier").notNull().default("free"),
  status: text("status").notNull(),
  currentPeriodStart: timestamp("current_period_start", {
    withTimezone: true,
  }).notNull(),
  currentPeriodEnd: timestamp("current_period_end", {
    withTimezone: true,
  }).notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// relationship_events — append-only event bus for RIE
// ---------------------------------------------------------------------------

export const relationshipEvents = pgTable(
  "relationship_events",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    eventType: relationshipEventTypeEnum("event_type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("relationship_events_couple_created_idx").on(
      table.coupleId,
      table.createdAt,
    ),
  ],
);

// ---------------------------------------------------------------------------
// achievements / reminders / room / challenges
// ---------------------------------------------------------------------------

export const achievements = pgTable("achievements", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("star"),
});

export const userAchievements = pgTable(
  "user_achievements",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_achievements_unique").on(
      table.coupleId,
      table.userId,
      table.achievementId,
    ),
  ],
);

export const reminders = pgTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("reminders_couple_due_idx").on(table.coupleId, table.dueAt)],
);

export const roomCustomizations = pgTable("room_customizations", {
  id: text("id").primaryKey(),
  coupleId: text("couple_id")
    .notNull()
    .unique()
    .references(() => couples.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("rose-dusk"),
  decor: jsonb("decor").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const challenges = pgTable(
  "challenges",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("active"),
    progress: integer("progress").notNull().default(0),
    goal: integer("goal").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("challenges_couple_status_idx").on(table.coupleId, table.status),
  ],
);

// ---------------------------------------------------------------------------
// calendar_events — shared couple date nights, rituals & anniversaries
// ---------------------------------------------------------------------------

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
    category: text("category").notNull().default("date_night"),
    reminderHours: integer("reminder_hours").notNull().default(24),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("calendar_events_couple_date_idx").on(
      table.coupleId,
      table.eventDate,
    ),
  ],
);

// ---------------------------------------------------------------------------
// time_capsules — sealed memories unlocked on future dates
// ---------------------------------------------------------------------------

export const timeCapsules = pgTable(
  "time_capsules",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    mediaStorageKey: text("media_storage_key"),
    unlockAt: timestamp("unlock_at", { withTimezone: true }).notNull(),
    isUnlocked: boolean("is_unlocked").notNull().default(false),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("time_capsules_couple_unlock_idx").on(
      table.coupleId,
      table.unlockAt,
    ),
  ],
);

// ---------------------------------------------------------------------------
// in_app_notifications — couple activity feed and ritual reminders
// ---------------------------------------------------------------------------

export const inAppNotifications = pgTable(
  "in_app_notifications",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    kind: text("kind").notNull().default("general"),
    link: text("link"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("in_app_notifications_user_read_idx").on(
      table.userId,
      table.read,
      table.createdAt,
    ),
    index("in_app_notifications_couple_user_idx").on(
      table.coupleId,
      table.userId,
      table.createdAt,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Weekly couple verification (hashed codes only)
// ---------------------------------------------------------------------------

export const coupleVerifications = pgTable(
  "couple_verifications",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    revealedToUserId: text("revealed_to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("couple_verifications_couple_period_idx").on(
      table.coupleId,
      table.periodEnd,
    ),
  ],
);

export const verificationAttemptLogs = pgTable(
  "verification_attempt_logs",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    success: boolean("success").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("verification_attempts_couple_created_idx").on(
      table.coupleId,
      table.createdAt,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Matchmaking Engine ("I Wanna Try My Luck")
// ---------------------------------------------------------------------------

export const matchmakingProfiles = pgTable(
  "matchmaking_profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    countryCode: text("country_code").notNull().default("IN"),
    age: integer("age").notNull(),
    ageRangeMin: integer("age_range_min").notNull().default(18),
    ageRangeMax: integer("age_range_max").notNull().default(99),
    interests: jsonb("interests").$type<string[]>().notNull().default([]),
    hobbies: jsonb("hobbies").$type<string[]>().notNull().default([]),
    personalityTraits: jsonb("personality_traits")
      .$type<string[]>()
      .notNull()
      .default([]),
    communicationStyle: text("communication_style")
      .notNull()
      .default("thoughtful"),
    relationshipGoals: text("relationship_goals")
      .notNull()
      .default("meaningful_connection"),
    lifestylePreferences: jsonb("lifestyle_preferences")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    conversationPreferences: jsonb("conversation_preferences")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    behavioralVector: jsonb("behavioral_vector")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    matchmakingEnabled: boolean("matchmaking_enabled").notNull().default(false),
    matchmakingPaused: boolean("matchmaking_paused").notNull().default(false),
    enabledAt: timestamp("enabled_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    algorithmVersion: integer("algorithm_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("matchmaking_profiles_country_age_idx").on(
      table.countryCode,
      table.age,
    ),
    index("matchmaking_profiles_enabled_idx").on(
      table.matchmakingEnabled,
      table.matchmakingPaused,
    ),
  ],
);

export const matchmakingInteractions = pgTable(
  "matchmaking_interactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: matchmakingActionEnum("action").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("matchmaking_interactions_user_candidate_idx").on(
      table.userId,
      table.candidateId,
    ),
    index("matchmaking_interactions_candidate_action_idx").on(
      table.candidateId,
      table.action,
    ),
  ],
);

export const matchmakingConnections = pgTable(
  "matchmaking_connections",
  {
    id: text("id").primaryKey(),
    userAId: text("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userBId: text("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: connectionStatusEnum("status").notNull().default("connected"),
    compatibilityScore: integer("compatibility_score").notNull().default(85),
    compatibilityReasons: jsonb("compatibility_reasons")
      .$type<string[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("matchmaking_connections_pair_idx").on(
      table.userAId,
      table.userBId,
    ),
    index("matchmaking_connections_user_a_idx").on(table.userAId),
    index("matchmaking_connections_user_b_idx").on(table.userBId),
  ],
);

export const matchmakingMessages = pgTable(
  "matchmaking_messages",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => matchmakingConnections.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("matchmaking_messages_connection_idx").on(
      table.connectionId,
      table.createdAt,
    ),
  ],
);

export const matchmakingReports = pgTable(
  "matchmaking_reports",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportedUserId: text("reported_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("matchmaking_reports_reported_idx").on(table.reportedUserId),
  ],
);

// ---------------------------------------------------------------------------
// doodle_canvases — lightweight persistent shared sketchbook for couples
// ---------------------------------------------------------------------------

export interface DoodlePoint {
  x: number;
  y: number;
}

export interface DoodleStroke {
  id: string;
  userId: string;
  tool: "pen" | "highlighter" | "eraser";
  color: string;
  width: number;
  points: DoodlePoint[];
  createdAt?: number;
}

export const doodleCanvases = pgTable(
  "doodle_canvases",
  {
    id: text("id").primaryKey(),
    coupleId: text("couple_id")
      .notNull()
      .unique()
      .references(() => couples.id, { onDelete: "cascade" }),
    strokes: jsonb("strokes")
      .$type<DoodleStroke[]>()
      .notNull()
      .default([]),
    snapshot: text("snapshot"),
    version: integer("version").notNull().default(1),
    lastDrawnById: text("last_drawn_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("doodle_canvases_couple_uidx").on(table.coupleId),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------


export const usersRelations = relations(users, ({ one, many }) => ({
  couple: one(couples, {
    fields: [users.coupleId],
    references: [couples.id],
  }),
  onboardingProfile: one(onboardingProfiles, {
    fields: [users.id],
    references: [onboardingProfiles.userId],
  }),
  coupleMemberships: many(coupleMembers),
  inviteTokens: many(inviteTokens),
  moods: many(moods),
  messages: many(messages),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
}));

export const onboardingProfilesRelations = relations(
  onboardingProfiles,
  ({ one }) => ({
    user: one(users, {
      fields: [onboardingProfiles.userId],
      references: [users.id],
    }),
  }),
);

export const inviteTokensRelations = relations(inviteTokens, ({ one }) => ({
  couple: one(couples, {
    fields: [inviteTokens.coupleId],
    references: [couples.id],
  }),
  inviter: one(users, {
    fields: [inviteTokens.inviterId],
    references: [users.id],
  }),
  usedBy: one(users, {
    fields: [inviteTokens.usedById],
    references: [users.id],
  }),
}));

export const coupleMembersRelations = relations(coupleMembers, ({ one }) => ({
  couple: one(couples, {
    fields: [coupleMembers.coupleId],
    references: [couples.id],
  }),
  user: one(users, {
    fields: [coupleMembers.userId],
    references: [users.id],
  }),
}));

export const couplesRelations = relations(couples, ({ one, many }) => ({
  userA: one(users, {
    fields: [couples.userAId],
    references: [users.id],
    relationName: "coupleUserA",
  }),
  userB: one(users, {
    fields: [couples.userBId],
    references: [users.id],
    relationName: "coupleUserB",
  }),
  members: many(coupleMembers),
  messages: many(messages),
  ephemeralMedia: many(ephemeralMedia),
  memories: many(memories),
  moods: many(moods),
  quizQuestions: many(quizQuestions),
  quizResponses: many(quizResponses),
  coupleStats: many(coupleStats),
  relationshipEvents: many(relationshipEvents),
  reminders: many(reminders),
  challenges: many(challenges),
  calendarEvents: many(calendarEvents),
  timeCapsules: many(timeCapsules),
  inAppNotifications: many(inAppNotifications),
  verifications: many(coupleVerifications),
  roomCustomization: one(roomCustomizations, {
    fields: [couples.id],
    references: [roomCustomizations.coupleId],
  }),
  aiInsight: one(aiInsights, {
    fields: [couples.id],
    references: [aiInsights.coupleId],
  }),
  doodleCanvas: one(doodleCanvases, {
    fields: [couples.id],
    references: [doodleCanvases.coupleId],
  }),
}));

export const doodleCanvasesRelations = relations(doodleCanvases, ({ one }) => ({
  couple: one(couples, {
    fields: [doodleCanvases.coupleId],
    references: [couples.id],
  }),
  lastDrawnBy: one(users, {
    fields: [doodleCanvases.lastDrawnById],
    references: [users.id],
  }),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  couple: one(couples, {
    fields: [calendarEvents.coupleId],
    references: [couples.id],
  }),
  createdBy: one(users, {
    fields: [calendarEvents.createdById],
    references: [users.id],
  }),
}));

export const timeCapsulesRelations = relations(timeCapsules, ({ one }) => ({
  couple: one(couples, {
    fields: [timeCapsules.coupleId],
    references: [couples.id],
  }),
  createdBy: one(users, {
    fields: [timeCapsules.createdById],
    references: [users.id],
  }),
}));

export const inAppNotificationsRelations = relations(inAppNotifications, ({ one }) => ({
  couple: one(couples, {
    fields: [inAppNotifications.coupleId],
    references: [couples.id],
  }),
  user: one(users, {
    fields: [inAppNotifications.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  couple: one(couples, {
    fields: [messages.coupleId],
    references: [couples.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  ephemeralMedia: one(ephemeralMedia, {
    fields: [messages.ephemeralMediaId],
    references: [ephemeralMedia.id],
  }),
}));

export const ephemeralMediaRelations = relations(ephemeralMedia, ({ one }) => ({
  couple: one(couples, {
    fields: [ephemeralMedia.coupleId],
    references: [couples.id],
  }),
  sender: one(users, {
    fields: [ephemeralMedia.senderId],
    references: [users.id],
  }),
}));

export const memoriesRelations = relations(memories, ({ one }) => ({
  couple: one(couples, {
    fields: [memories.coupleId],
    references: [couples.id],
  }),
  uploader: one(users, {
    fields: [memories.uploaderId],
    references: [users.id],
  }),
}));

export const moodsRelations = relations(moods, ({ one }) => ({
  couple: one(couples, {
    fields: [moods.coupleId],
    references: [couples.id],
  }),
  user: one(users, {
    fields: [moods.userId],
    references: [users.id],
  }),
}));

export const quizQuestionsRelations = relations(
  quizQuestions,
  ({ one, many }) => ({
    couple: one(couples, {
      fields: [quizQuestions.coupleId],
      references: [couples.id],
    }),
    responses: many(quizResponses),
  }),
);

export const quizResponsesRelations = relations(quizResponses, ({ one }) => ({
  questionSet: one(quizQuestions, {
    fields: [quizResponses.questionSetId],
    references: [quizQuestions.id],
  }),
  couple: one(couples, {
    fields: [quizResponses.coupleId],
    references: [couples.id],
  }),
  user: one(users, {
    fields: [quizResponses.userId],
    references: [users.id],
  }),
}));

export const coupleStatsRelations = relations(coupleStats, ({ one }) => ({
  couple: one(couples, {
    fields: [coupleStats.coupleId],
    references: [couples.id],
  }),
}));

export const aiInsightsRelations = relations(aiInsights, ({ one }) => ({
  couple: one(couples, {
    fields: [aiInsights.coupleId],
    references: [couples.id],
  }),
}));

export const watchSessionsRelations = relations(watchSessions, ({ one, many }) => ({
  couple: one(couples, {
    fields: [watchSessions.coupleId],
    references: [couples.id],
  }),
  hostUser: one(users, {
    fields: [watchSessions.hostUserId],
    references: [users.id],
  }),
  participants: many(watchParticipants),
  events: many(watchEvents),
  messages: many(watchMessages),
  memory: one(movieMemories, {
    fields: [watchSessions.id],
    references: [movieMemories.sessionId],
  }),
}));

export const watchParticipantsRelations = relations(watchParticipants, ({ one }) => ({
  session: one(watchSessions, {
    fields: [watchParticipants.sessionId],
    references: [watchSessions.id],
  }),
  user: one(users, {
    fields: [watchParticipants.userId],
    references: [users.id],
  }),
}));

export const watchEventsRelations = relations(watchEvents, ({ one }) => ({
  session: one(watchSessions, {
    fields: [watchEvents.sessionId],
    references: [watchSessions.id],
  }),
  user: one(users, {
    fields: [watchEvents.userId],
    references: [users.id],
  }),
}));

export const watchMessagesRelations = relations(watchMessages, ({ one }) => ({
  session: one(watchSessions, {
    fields: [watchMessages.sessionId],
    references: [watchSessions.id],
  }),
  user: one(users, {
    fields: [watchMessages.userId],
    references: [users.id],
  }),
}));

export const movieMemoriesRelations = relations(movieMemories, ({ one }) => ({
  couple: one(couples, {
    fields: [movieMemories.coupleId],
    references: [couples.id],
  }),
  session: one(watchSessions, {
    fields: [movieMemories.sessionId],
    references: [watchSessions.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type OnboardingProfile = typeof onboardingProfiles.$inferSelect;
export type NewOnboardingProfile = typeof onboardingProfiles.$inferInsert;

export type InviteToken = typeof inviteTokens.$inferSelect;
export type NewInviteToken = typeof inviteTokens.$inferInsert;

export type Couple = typeof couples.$inferSelect;
export type NewCouple = typeof couples.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type EphemeralMedia = typeof ephemeralMedia.$inferSelect;
export type NewEphemeralMedia = typeof ephemeralMedia.$inferInsert;

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;

export type Mood = typeof moods.$inferSelect;
export type NewMood = typeof moods.$inferInsert;

export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type NewQuizQuestion = typeof quizQuestions.$inferInsert;

export type QuizResponse = typeof quizResponses.$inferSelect;
export type NewQuizResponse = typeof quizResponses.$inferInsert;

export type CoupleStat = typeof coupleStats.$inferSelect;
export type NewCoupleStat = typeof coupleStats.$inferInsert;

export type AiInsight = typeof aiInsights.$inferSelect;
export type NewAiInsight = typeof aiInsights.$inferInsert;

export type WatchSession = typeof watchSessions.$inferSelect;
export type NewWatchSession = typeof watchSessions.$inferInsert;

export type WatchParticipant = typeof watchParticipants.$inferSelect;
export type NewWatchParticipant = typeof watchParticipants.$inferInsert;

export type WatchEvent = typeof watchEvents.$inferSelect;
export type NewWatchEvent = typeof watchEvents.$inferInsert;

export type WatchMessage = typeof watchMessages.$inferSelect;
export type NewWatchMessage = typeof watchMessages.$inferInsert;

export type MovieMemory = typeof movieMemories.$inferSelect;
export type NewMovieMemory = typeof movieMemories.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type RelationshipEvent = typeof relationshipEvents.$inferSelect;
export type NewRelationshipEvent = typeof relationshipEvents.$inferInsert;

export type Achievement = typeof achievements.$inferSelect;
export type NewAchievement = typeof achievements.$inferInsert;

export type UserAchievement = typeof userAchievements.$inferSelect;
export type NewUserAchievement = typeof userAchievements.$inferInsert;

export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;

export type RoomCustomization = typeof roomCustomizations.$inferSelect;
export type NewRoomCustomization = typeof roomCustomizations.$inferInsert;

export type Challenge = typeof challenges.$inferSelect;
export type NewChallenge = typeof challenges.$inferInsert;

export type CoupleVerification = typeof coupleVerifications.$inferSelect;
export type NewCoupleVerification = typeof coupleVerifications.$inferInsert;

export type VerificationAttemptLog = typeof verificationAttemptLogs.$inferSelect;
export type NewVerificationAttemptLog =
  typeof verificationAttemptLogs.$inferInsert;

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type NewCalendarEvent = typeof calendarEvents.$inferInsert;

export type TimeCapsule = typeof timeCapsules.$inferSelect;
export type NewTimeCapsule = typeof timeCapsules.$inferInsert;

export type InAppNotification = typeof inAppNotifications.$inferSelect;
export type NewInAppNotification = typeof inAppNotifications.$inferInsert;

export type MatchmakingProfile = typeof matchmakingProfiles.$inferSelect;
export type NewMatchmakingProfile = typeof matchmakingProfiles.$inferInsert;

export type MatchmakingInteraction = typeof matchmakingInteractions.$inferSelect;
export type NewMatchmakingInteraction = typeof matchmakingInteractions.$inferInsert;

export type MatchmakingConnection = typeof matchmakingConnections.$inferSelect;
export type NewMatchmakingConnection = typeof matchmakingConnections.$inferInsert;

export type MatchmakingMessage = typeof matchmakingMessages.$inferSelect;
export type NewMatchmakingMessage = typeof matchmakingMessages.$inferInsert;

export type MatchmakingReport = typeof matchmakingReports.$inferSelect;
export type NewMatchmakingReport = typeof matchmakingReports.$inferInsert;

export type CoupleMember = typeof coupleMembers.$inferSelect;
export type NewCoupleMember = typeof coupleMembers.$inferInsert;

export type DoodleCanvas = typeof doodleCanvases.$inferSelect;
export type NewDoodleCanvas = typeof doodleCanvases.$inferInsert;
