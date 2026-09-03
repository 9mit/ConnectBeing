import { MatchmakingProfile } from "@/db/schema";
import {
  CompatibilityResult,
  CompatibilityVector,
  CompatibilityLevel,
} from "./types";

export const MATCH_WEIGHTS = {
  interests: 0.25,
  communication: 0.20,
  goals: 0.20,
  personality: 0.15,
  lifestyle: 0.10,
  geography: 0.05,
  behavior: 0.05,
} as const;

/** Calculate set overlap (Jaccard similarity) between string arrays */
function jaccardSimilarity(a: string[] = [], b: string[] = []): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a.map((s) => s.trim().toLowerCase()));
  const setB = new Set(b.map((s) => s.trim().toLowerCase()));

  let intersection = 0;
  setA.forEach((item) => {
    if (setB.has(item)) intersection++;
  });
  const union = new Set(Array.from(setA).concat(Array.from(setB))).size;
  return union === 0 ? 0 : intersection / union;
}

/** Check reciprocal age compatibility */
function calculateAgeScore(
  a: Pick<MatchmakingProfile, "age" | "ageRangeMin" | "ageRangeMax">,
  b: Pick<MatchmakingProfile, "age" | "ageRangeMin" | "ageRangeMax">,
): number {
  const aFitsB = a.age >= b.ageRangeMin && a.age <= b.ageRangeMax;
  const bFitsA = b.age >= a.ageRangeMin && b.age <= a.ageRangeMax;

  if (aFitsB && bFitsA) return 1.0;
  if (aFitsB || bFitsA) return 0.5;

  const diff = Math.abs(a.age - b.age);
  if (diff <= 3) return 0.8;
  if (diff <= 6) return 0.6;
  if (diff <= 10) return 0.4;
  return 0.2;
}

/** Check communication style compatibility */
function calculateCommunicationScore(styleA?: string, styleB?: string): number {
  if (!styleA || !styleB) return 0.5;
  const a = styleA.toLowerCase().trim();
  const b = styleB.toLowerCase().trim();

  if (a === b) return 1.0;

  // Compatible complementary pairings
  const complementaryPairs: Record<string, string[]> = {
    thoughtful: ["deep", "calm", "gentle"],
    playful: ["witty", "energetic", "fun"],
    direct: ["honest", "clear", "thoughtful"],
    deep: ["thoughtful", "intellectual", "listener"],
  };

  if (complementaryPairs[a]?.includes(b) || complementaryPairs[b]?.includes(a)) {
    return 0.85;
  }
  return 0.6;
}

/** Check relationship goals compatibility */
function calculateGoalsScore(goalA?: string, goalB?: string): number {
  if (!goalA || !goalB) return 0.5;
  const a = goalA.toLowerCase().trim();
  const b = goalB.toLowerCase().trim();

  if (a === b) return 1.0;

  if (
    (a.includes("long_term") && b.includes("meaningful")) ||
    (a.includes("meaningful") && b.includes("long_term"))
  ) {
    return 0.9;
  }
  return 0.5;
}

/** Cosine similarity for behavioral signal vectors */
function calculateBehavioralScore(
  vecA?: Record<string, number> | null,
  vecB?: Record<string, number> | null,
): number {
  if (!vecA || !vecB || !Object.keys(vecA).length || !Object.keys(vecB).length) {
    return 0.6; // Neutral baseline for cold-start
  }

  const keys = Array.from(new Set([...Object.keys(vecA), ...Object.keys(vecB)]));
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const k of keys) {
    const valA = vecA[k] || 0;
    const valB = vecB[k] || 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0.6;
  return Math.min(1.0, Math.max(0.1, dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))));
}

export function calculateCompatibility(
  profileA: MatchmakingProfile,
  profileB: MatchmakingProfile,
): CompatibilityResult {
  // 1. Calculate Individual Dimensional Scores
  const combinedInterestsA = [...(profileA.interests || []), ...(profileA.hobbies || [])];
  const combinedInterestsB = [...(profileB.interests || []), ...(profileB.hobbies || [])];
  const interestsScore = jaccardSimilarity(combinedInterestsA, combinedInterestsB);

  const personalityScore = jaccardSimilarity(
    profileA.personalityTraits || [],
    profileB.personalityTraits || [],
  );

  const communicationScore = calculateCommunicationScore(
    profileA.communicationStyle,
    profileB.communicationStyle,
  );

  const goalsScore = calculateGoalsScore(
    profileA.relationshipGoals,
    profileB.relationshipGoals,
  );

  const ageScore = calculateAgeScore(profileA, profileB);

  const geographyScore =
    profileA.countryCode.toUpperCase() === profileB.countryCode.toUpperCase() ? 1.0 : 0.7;

  const lifestyleScore = 0.75; // Baseline lifestyle overlap
  const behaviorScore = calculateBehavioralScore(
    profileA.behavioralVector,
    profileB.behavioralVector,
  );

  const vector: CompatibilityVector = {
    interests: Math.round(interestsScore * 100) / 100,
    personality: Math.round(personalityScore * 100) / 100,
    communication: Math.round(communicationScore * 100) / 100,
    lifestyle: Math.round(lifestyleScore * 100) / 100,
    goals: Math.round(goalsScore * 100) / 100,
    age: Math.round(ageScore * 100) / 100,
    geography: Math.round(geographyScore * 100) / 100,
    behavior: Math.round(behaviorScore * 100) / 100,
  };

  // 2. Weighted Overall Score
  const rawScore =
    vector.interests * MATCH_WEIGHTS.interests +
    vector.communication * MATCH_WEIGHTS.communication +
    vector.goals * MATCH_WEIGHTS.goals +
    vector.personality * MATCH_WEIGHTS.personality +
    vector.lifestyle * MATCH_WEIGHTS.lifestyle +
    vector.geography * MATCH_WEIGHTS.geography +
    vector.behavior * MATCH_WEIGHTS.behavior;

  // Normalized to 60 - 98 scale for human warmth
  const overallScore = Math.min(98, Math.max(60, Math.round(rawScore * 100)));

  // 3. Determine Level
  let compatibilityLevel: CompatibilityLevel = "Moderate";
  if (overallScore >= 88) compatibilityLevel = "Very High";
  else if (overallScore >= 80) compatibilityLevel = "High";
  else if (overallScore >= 72) compatibilityLevel = "Strong";

  // 4. Generate Explainable Match Reasons
  const reasons: string[] = [];

  // Find shared interests names
  const sharedInterests = (profileA.interests || []).filter((i) =>
    (profileB.interests || []).map((x) => x.toLowerCase()).includes(i.toLowerCase()),
  );
  if (sharedInterests.length > 0) {
    reasons.push(
      `Shared affinity for ${sharedInterests.slice(0, 3).join(", ")}${sharedInterests.length > 3 ? " and more" : ""}`,
    );
  }

  if (communicationScore >= 0.8) {
    reasons.push("Compatible communication style and conversation pace");
  }

  if (goalsScore >= 0.8) {
    reasons.push("Aligned expectations for a genuine, supportive connection");
  }

  if (geographyScore === 1.0) {
    reasons.push(`Both based in ${profileA.countryCode.toUpperCase()} with shared cultural context`);
  }

  if (personalityScore >= 0.3) {
    reasons.push("Harmonious personality traits and shared perspective");
  }

  if (reasons.length === 0) {
    reasons.push("Complementary relationship balance and open curiosity");
  }

  const confidenceScore = Math.min(
    1.0,
    0.6 +
      (combinedInterestsA.length > 3 ? 0.15 : 0) +
      (Object.keys(profileA.behavioralVector || {}).length > 2 ? 0.15 : 0) +
      (Object.keys(profileB.behavioralVector || {}).length > 2 ? 0.1 : 0),
  );

  return {
    overallScore,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    compatibilityLevel,
    vector,
    reasons: reasons.slice(0, 4),
  };
}
