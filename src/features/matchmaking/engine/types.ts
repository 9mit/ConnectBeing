/**
 * Types & Interfaces for MadLove Matchmaking Engine ("I Wanna Try My Luck")
 */

export interface CompatibilityVector {
  interests: number;     // 0 to 1
  communication: number; // 0 to 1
  goals: number;         // 0 to 1
  personality: number;   // 0 to 1
  lifestyle: number;     // 0 to 1
  age: number;           // 0 to 1
  geography: number;     // 0 to 1
  behavior: number;      // 0 to 1
}

export type CompatibilityLevel = "Moderate" | "High" | "Strong" | "Very High";

export interface CompatibilityResult {
  overallScore: number; // 0 to 100
  confidenceScore: number; // 0 to 1
  compatibilityLevel: CompatibilityLevel;
  vector: CompatibilityVector;
  reasons: string[];
}

export interface PrivacySafeMatchCard {
  candidateId: string; // opaque identifier
  countryCode: string; // ISO 3166-1 alpha-2
  age: number; // adult age >= 18
  interests: string[];
  hobbies: string[];
  personalityTraits: string[];
  communicationStyle: string;
  relationshipGoals: string;
  compatibilityLevel: CompatibilityLevel;
  matchReasons: string[];
}

export interface MatchmakingProfileInput {
  countryCode: string;
  age: number;
  ageRangeMin?: number;
  ageRangeMax?: number;
  interests: string[];
  hobbies: string[];
  personalityTraits: string[];
  communicationStyle: string;
  relationshipGoals: string;
  lifestylePreferences?: Record<string, unknown>;
  conversationPreferences?: Record<string, unknown>;
}
