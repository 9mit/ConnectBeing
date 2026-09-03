import { and, eq, notInArray, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  matchmakingProfiles,
  matchmakingInteractions,
  matchmakingReports,
  MatchmakingProfile,
} from "@/db/schema";
import { calculateCompatibility } from "./compatibility";
import { PrivacySafeMatchCard } from "./types";

/**
 * Discovers the next eligible candidate for a user and formats
 * into an opaque, privacy-safe match card.
 */
export async function getNextCandidateForUser(
  userId: string,
): Promise<PrivacySafeMatchCard | null> {
  // 1. Fetch current user's matchmaking profile
  const userProfile = await db.query.matchmakingProfiles.findFirst({
    where: eq(matchmakingProfiles.userId, userId),
  });

  if (!userProfile || !userProfile.matchmakingEnabled || userProfile.matchmakingPaused) {
    return null;
  }

  // 2. Fetch IDs of already-interacted users (passed, interested, blocked)
  const existingInteractions = await db.query.matchmakingInteractions.findMany({
    where: eq(matchmakingInteractions.userId, userId),
    columns: { candidateId: true },
  });
  const interactedIds = new Set(existingInteractions.map((i) => i.candidateId));

  // 3. Fetch users who have blocked current user or reported current user
  const blockedReports = await db.query.matchmakingReports.findMany({
    where: eq(matchmakingReports.reportedUserId, userId),
    columns: { reporterId: true },
  });
  blockedReports.forEach((r) => interactedIds.add(r.reporterId));

  interactedIds.add(userId);

  // 4. Fetch candidate pool
  const candidates = await db.query.matchmakingProfiles.findMany({
    where: and(
      eq(matchmakingProfiles.matchmakingEnabled, true),
      eq(matchmakingProfiles.matchmakingPaused, false),
      ne(matchmakingProfiles.userId, userId),
    ),
    limit: 25,
  });

  const availableCandidates = candidates.filter((c) => !interactedIds.has(c.userId));
  if (!availableCandidates.length) {
    return null;
  }

  // 5. Score all candidates using Multi-Dimensional Compatibility Engine
  const scored = availableCandidates.map((candidate) => ({
    candidate,
    result: calculateCompatibility(userProfile, candidate),
  }));

  // Sort by compatibility score descending
  scored.sort((a, b) => b.result.overallScore - a.result.overallScore);

  const best = scored[0];
  if (!best) return null;

  // 6. Apply Strict Privacy Filter
  return toPrivacySafeMatchCard(best.candidate, best.result.reasons, best.result.compatibilityLevel);
}

/**
 * Strict Privacy Filter:
 * Strips all personal identifiers, email, real names, exact locations,
 * and returns only high-level compatibility themes.
 */
export function toPrivacySafeMatchCard(
  candidate: MatchmakingProfile,
  matchReasons: string[],
  compatibilityLevel: PrivacySafeMatchCard["compatibilityLevel"],
): PrivacySafeMatchCard {
  return {
    candidateId: candidate.userId, // Will be mapped to opaque candidate token in action
    countryCode: candidate.countryCode.toUpperCase(),
    age: candidate.age,
    interests: candidate.interests || [],
    hobbies: candidate.hobbies || [],
    personalityTraits: candidate.personalityTraits || [],
    communicationStyle: candidate.communicationStyle,
    relationshipGoals: candidate.relationshipGoals,
    compatibilityLevel,
    matchReasons,
  };
}
