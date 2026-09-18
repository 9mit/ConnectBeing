"use server";

import { and, eq, or, desc } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  matchmakingProfiles,
  matchmakingInteractions,
  matchmakingConnections,
  matchmakingMessages,
  matchmakingReports,
  onboardingProfiles,
} from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireAppUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { rateLimitOrThrow } from "@/lib/security";
import {
  calculateCompatibility,
  getNextCandidateForUser,
  PrivacySafeMatchCard,
  MatchmakingProfileInput,
  resolveCandidateId,
} from "@/features/matchmaking";

const profileSchema = z.object({
  countryCode: z.string().trim().length(2).toUpperCase(),
  age: z.number().int().min(18, "Matchmaking is strictly for adults (18+)").max(100),
  ageRangeMin: z.number().int().min(18).max(100).optional(),
  ageRangeMax: z.number().int().min(18).max(100).optional(),
  interests: z.array(z.string().trim().max(40)).max(15),
  hobbies: z.array(z.string().trim().max(40)).max(15),
  personalityTraits: z.array(z.string().trim().max(40)).max(10),
  communicationStyle: z.string().trim().min(1).max(50),
  relationshipGoals: z.string().trim().min(1).max(50),
});

const interactionSchema = z.object({
  candidateId: z.string().min(1),
  action: z.enum(["interested", "passed", "saved_later"]),
});

const messageSchema = z.object({
  connectionId: z.string().min(1),
  content: z.string().trim().min(1).max(1000),
});

const reportSchema = z.object({
  candidateId: z.string().min(1),
  category: z.string().trim().min(1).max(50),
  details: z.string().trim().max(500).optional(),
});

/**
 * Fetch current user's matchmaking status and preferences
 */
export async function getMatchmakingStatusAction(): Promise<
  ActionResult<{
    hasProfile: boolean;
    enabled: boolean;
    paused: boolean;
    age?: number;
    countryCode?: string;
  }>
> {
  try {
    const user = await requireAppUser();
    const profile = await db.query.matchmakingProfiles.findFirst({
      where: eq(matchmakingProfiles.userId, user.id),
    });

    if (!profile) {
      // Check onboarding profile to prepopulate
      const ob = await db.query.onboardingProfiles.findFirst({
        where: eq(onboardingProfiles.userId, user.id),
      });

      return ok({
        hasProfile: false,
        enabled: false,
        paused: false,
        age: ob?.age,
        countryCode: ob?.countryCode,
      });
    }

    return ok({
      hasProfile: true,
      enabled: profile.matchmakingEnabled,
      paused: profile.matchmakingPaused,
      age: profile.age,
      countryCode: profile.countryCode,
    });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Update Matchmaking Opt-In Consent
 */
export async function setMatchmakingConsentAction(
  enabled: boolean,
): Promise<ActionResult<{ enabled: boolean }>> {
  try {
    const user = await requireAppUser();

    let profile = await db.query.matchmakingProfiles.findFirst({
      where: eq(matchmakingProfiles.userId, user.id),
    });

    const now = new Date();

    if (!profile) {
      // Auto-populate baseline from onboarding
      const ob = await db.query.onboardingProfiles.findFirst({
        where: eq(onboardingProfiles.userId, user.id),
      });

      const age = ob?.age ?? 24;
      if (age < 18) {
        throw new AppError("FORBIDDEN", "Matchmaking is strictly for adults (18+).", 403);
      }

      await db.insert(matchmakingProfiles).values({
        id: createId(),
        userId: user.id,
        countryCode: ob?.countryCode ?? "IN",
        age,
        interests: ob?.hobbies ?? ["Cinema", "Travel", "Music"],
        hobbies: ob?.hobbies ?? ["Reading", "Conversations"],
        personalityTraits: ["Thoughtful", "Kind", "Open-minded"],
        communicationStyle: "thoughtful",
        relationshipGoals: "meaningful_connection",
        matchmakingEnabled: enabled,
        enabledAt: enabled ? now : null,
      });
    } else {
      await db
        .update(matchmakingProfiles)
        .set({
          matchmakingEnabled: enabled,
          enabledAt: enabled ? now : profile.enabledAt,
          updatedAt: now,
        })
        .where(eq(matchmakingProfiles.id, profile.id));
    }

    return ok({ enabled });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Toggle Matchmaking Paused State
 */
export async function setMatchmakingPausedAction(
  paused: boolean,
): Promise<ActionResult<{ paused: boolean }>> {
  try {
    const user = await requireAppUser();
    const now = new Date();

    const updated = await db
      .update(matchmakingProfiles)
      .set({
        matchmakingPaused: paused,
        pausedAt: paused ? now : null,
        updatedAt: now,
      })
      .where(eq(matchmakingProfiles.userId, user.id))
      .returning({ id: matchmakingProfiles.id });

    if (updated.length === 0) {
      throw new AppError(
        "NOT_FOUND",
        "Matchmaking profile not found. Set up your profile first.",
        404,
      );
    }

    return ok({ paused });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Save or update full matchmaking profile
 */
export async function saveMatchmakingProfileAction(
  input: unknown,
): Promise<ActionResult<{ saved: true }>> {
  try {
    const user = await requireAppUser();
    const parsed = profileSchema.parse(input);

    if (parsed.age < 18) {
      throw new AppError("FORBIDDEN", "Matchmaking is strictly for adults (18+).", 403);
    }

    const existing = await db.query.matchmakingProfiles.findFirst({
      where: eq(matchmakingProfiles.userId, user.id),
    });

    const now = new Date();

    if (existing) {
      await db
        .update(matchmakingProfiles)
        .set({
          countryCode: parsed.countryCode,
          age: parsed.age,
          ageRangeMin: parsed.ageRangeMin ?? existing.ageRangeMin,
          ageRangeMax: parsed.ageRangeMax ?? existing.ageRangeMax,
          interests: parsed.interests,
          hobbies: parsed.hobbies,
          personalityTraits: parsed.personalityTraits,
          communicationStyle: parsed.communicationStyle,
          relationshipGoals: parsed.relationshipGoals,
          updatedAt: now,
        })
        .where(eq(matchmakingProfiles.id, existing.id));
    } else {
      await db.insert(matchmakingProfiles).values({
        id: createId(),
        userId: user.id,
        countryCode: parsed.countryCode,
        age: parsed.age,
        ageRangeMin: parsed.ageRangeMin ?? 18,
        ageRangeMax: parsed.ageRangeMax ?? 99,
        interests: parsed.interests,
        hobbies: parsed.hobbies,
        personalityTraits: parsed.personalityTraits,
        communicationStyle: parsed.communicationStyle,
        relationshipGoals: parsed.relationshipGoals,
        matchmakingEnabled: true,
        enabledAt: now,
      });
    }

    return ok({ saved: true });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Discover the next eligible candidate for current user
 */
export async function getNextCandidateAction(): Promise<
  ActionResult<PrivacySafeMatchCard | null>
> {
  try {
    const user = await requireAppUser();
    const card = await getNextCandidateForUser(user.id);
    return ok(card);
  } catch (e) {
    return fail(e);
  }
}

/**
 * Record user response ("interested", "passed", "saved_later")
 * Detects mutual interest and forms an introduction connection.
 */
export async function respondToCandidateAction(
  input: unknown,
): Promise<ActionResult<{ actionRecorded: true; mutualMatch: boolean; connectionId?: string }>> {
  try {
    const user = await requireAppUser();
    const parsed = interactionSchema.parse(input);
    await rateLimitOrThrow({
      key: `rl:match:respond:${user.id}`,
      limit: 30,
      windowSeconds: 60,
      message: "Please slow down — taking a moment between profiles is encouraged.",
    });

    const candidateUserId = resolveCandidateId(parsed.candidateId, user.id);

    if (candidateUserId === user.id) {
      throw new AppError("VALIDATION_ERROR", "Cannot interact with yourself.", 400);
    }

    // 1. Record interaction in database
    await db
      .insert(matchmakingInteractions)
      .values({
        id: createId(),
        userId: user.id,
        candidateId: candidateUserId,
        action: parsed.action,
      })
      .onConflictDoUpdate({
        target: [matchmakingInteractions.userId, matchmakingInteractions.candidateId],
        set: { action: parsed.action, createdAt: new Date() },
      });

    // 2. If not "interested", return immediately
    if (parsed.action !== "interested") {
      return ok({ actionRecorded: true, mutualMatch: false });
    }

    // 3. Check for Mutual Interest: Has candidate also marked "interested" for user?
    const candidateInteraction = await db.query.matchmakingInteractions.findFirst({
      where: and(
        eq(matchmakingInteractions.userId, candidateUserId),
        eq(matchmakingInteractions.candidateId, user.id),
        eq(matchmakingInteractions.action, "interested"),
      ),
    });

    if (!candidateInteraction) {
      return ok({ actionRecorded: true, mutualMatch: false });
    }

    // 4. Mutual match found! Create or fetch existing connection
    let connection = await db.query.matchmakingConnections.findFirst({
      where: or(
        and(
          eq(matchmakingConnections.userAId, user.id),
          eq(matchmakingConnections.userBId, candidateUserId),
        ),
        and(
          eq(matchmakingConnections.userAId, candidateUserId),
          eq(matchmakingConnections.userBId, user.id),
        ),
      ),
    });

    if (!connection) {
      const userProfile = await db.query.matchmakingProfiles.findFirst({
        where: eq(matchmakingProfiles.userId, user.id),
      });
      const candidateProfile = await db.query.matchmakingProfiles.findFirst({
        where: eq(matchmakingProfiles.userId, candidateUserId),
      });

      const comp =
        userProfile && candidateProfile
          ? calculateCompatibility(userProfile, candidateProfile)
          : { overallScore: 85, reasons: ["Complementary connection"] };

      const connectionId = createId();
      await db.insert(matchmakingConnections).values({
        id: connectionId,
        userAId: user.id,
        userBId: candidateUserId,
        status: "connected",
        compatibilityScore: comp.overallScore,
        compatibilityReasons: comp.reasons,
      });

      return ok({
        actionRecorded: true,
        mutualMatch: true,
        connectionId,
      });
    }

    return ok({
      actionRecorded: true,
      mutualMatch: true,
      connectionId: connection.id,
    });
  } catch (e) {
    return fail(e);
  }
}

/**
 * List active mutual matchmaking connections for current user
 */
export async function getConnectionsAction(): Promise<
  ActionResult<
    Array<{
      id: string;
      partnerAge: number;
      partnerCountry: string;
      compatibilityScore: number;
      reasons: string[];
      createdAt: string;
    }>
  >
> {
  try {
    const user = await requireAppUser();

    const conns = await db.query.matchmakingConnections.findMany({
      where: and(
        or(
          eq(matchmakingConnections.userAId, user.id),
          eq(matchmakingConnections.userBId, user.id),
        ),
        eq(matchmakingConnections.status, "connected"),
      ),
      orderBy: [desc(matchmakingConnections.createdAt)],
    });

    const results = [];
    for (const c of conns) {
      const partnerId = c.userAId === user.id ? c.userBId : c.userAId;
      const partnerProfile = await db.query.matchmakingProfiles.findFirst({
        where: eq(matchmakingProfiles.userId, partnerId),
      });

      results.push({
        id: c.id,
        partnerAge: partnerProfile?.age ?? 25,
        partnerCountry: partnerProfile?.countryCode.toUpperCase() ?? "IN",
        compatibilityScore: c.compatibilityScore,
        reasons: c.compatibilityReasons ?? [],
        createdAt: c.createdAt.toISOString(),
      });
    }

    return ok(results);
  } catch (e) {
    return fail(e);
  }
}

/**
 * Get messages in an introductory matchmaking connection
 */
export async function getConnectionMessagesAction(
  connectionId: string,
): Promise<
  ActionResult<
    Array<{
      id: string;
      senderId: string;
      content: string;
      createdAt: string;
      isMine: boolean;
    }>
  >
> {
  try {
    const user = await requireAppUser();

    // Verify user is a member of this connection
    const conn = await db.query.matchmakingConnections.findFirst({
      where: and(
        eq(matchmakingConnections.id, connectionId),
        or(
          eq(matchmakingConnections.userAId, user.id),
          eq(matchmakingConnections.userBId, user.id),
        ),
        eq(matchmakingConnections.status, "connected"),
      ),
    });

    if (!conn) {
      throw new AppError("FORBIDDEN", "Not a member of this connection.", 403);
    }

    const msgs = await db.query.matchmakingMessages.findMany({
      where: eq(matchmakingMessages.connectionId, connectionId),
      orderBy: [desc(matchmakingMessages.createdAt)],
      limit: 50,
    });

    return ok(
      msgs
        .reverse()
        .map((m) => ({
          id: m.id,
          senderId: m.senderId,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          isMine: m.senderId === user.id,
        })),
    );
  } catch (e) {
    return fail(e);
  }
}

/**
 * Send an introductory message in a mutual connection
 */
export async function sendConnectionMessageAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAppUser();
    const parsed = messageSchema.parse(input);
    await rateLimitOrThrow({
      key: `rl:match:msg:${user.id}`,
      limit: 30,
      windowSeconds: 60,
      message: "Too many messages sent. Please slow down.",
    });

    const conn = await db.query.matchmakingConnections.findFirst({
      where: and(
        eq(matchmakingConnections.id, parsed.connectionId),
        or(
          eq(matchmakingConnections.userAId, user.id),
          eq(matchmakingConnections.userBId, user.id),
        ),
        eq(matchmakingConnections.status, "connected"),
      ),
    });

    if (!conn) {
      throw new AppError("FORBIDDEN", "Not a member of this connection.", 403);
    }

    const messageId = createId();
    await db.insert(matchmakingMessages).values({
      id: messageId,
      connectionId: parsed.connectionId,
      senderId: user.id,
      content: parsed.content,
    });

    return ok({ id: messageId });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Report and immediately block a candidate
 */
export async function reportAndBlockCandidateAction(
  input: unknown,
): Promise<ActionResult<{ blocked: true }>> {
  try {
    const user = await requireAppUser();
    const parsed = reportSchema.parse(input);

    const candidateUserId = resolveCandidateId(parsed.candidateId, user.id);

    // 1. Log report
    await db.insert(matchmakingReports).values({
      id: createId(),
      reporterId: user.id,
      reportedUserId: candidateUserId,
      category: parsed.category,
      details: parsed.details,
    });

    // 2. Mark interaction as blocked
    await db
      .insert(matchmakingInteractions)
      .values({
        id: createId(),
        userId: user.id,
        candidateId: candidateUserId,
        action: "blocked",
        reason: parsed.category,
      })
      .onConflictDoUpdate({
        target: [matchmakingInteractions.userId, matchmakingInteractions.candidateId],
        set: { action: "blocked", reason: parsed.category },
      });

    // 3. Disconnect connection if exists
    await db
      .update(matchmakingConnections)
      .set({ status: "blocked", updatedAt: new Date() })
      .where(
        or(
          and(
            eq(matchmakingConnections.userAId, user.id),
            eq(matchmakingConnections.userBId, candidateUserId),
          ),
          and(
            eq(matchmakingConnections.userAId, candidateUserId),
            eq(matchmakingConnections.userBId, user.id),
          ),
        ),
      );

    return ok({ blocked: true });
  } catch (e) {
    return fail(e);
  }
}
