export interface Recommendation {
  category: "movie" | "date" | "conversation" | "game" | "music" | "challenge";
  title: string;
  description: string;
  reason: string;
}

const STATIC_DATE_IDEAS = [
  {
    title: "Cook a new recipe together",
    description: "Pick a cuisine neither of you has tried and cook it tonight.",
    category: "date" as const,
  },
  {
    title: "Stargazing and deep talks",
    description: "Grab a blanket and look at the stars while asking deep questions.",
    category: "date" as const,
  },
  {
    title: "Indoor picnic date",
    description: "Set up a blanket in the living room and prepare finger foods.",
    category: "date" as const,
  },
  {
    title: "Museum / Gallery walk",
    description: "Visit a local exhibit and discuss your favorite art pieces.",
    category: "date" as const,
  },
  {
    title: "Board game tournament",
    description: "Play a competitive board or card game with small stakes.",
    category: "date" as const,
  },
];

const STATIC_CONVO_STARTERS = [
  {
    title: "Childhood dreams",
    description: "What did you want to be when you grew up, and why?",
    category: "conversation" as const,
  },
  {
    title: "Ideal future day",
    description: "Describe a perfect Saturday 10 years from now.",
    category: "conversation" as const,
  },
  {
    title: "First impression",
    description: "What did you honestly think of me when we first met?",
    category: "conversation" as const,
  },
  {
    title: "Fear and courage",
    description: "What is a fear you have recently overcome?",
    category: "conversation" as const,
  },
  {
    title: "Gratitude",
    description: "Name three small things you appreciate about us this week.",
    category: "conversation" as const,
  },
];

const STATIC_MOVIES = [
  {
    title: "Interstellar",
    description: "A mind-bending sci-fi odyssey about love transcending time and space.",
    category: "movie" as const,
  },
  {
    title: "About Time",
    description: "A heartwarming romantic drama about everyday life.",
    category: "movie" as const,
  },
  {
    title: "The Grand Budapest Hotel",
    description: "A quirky, stylized comedy mystery.",
    category: "movie" as const,
  },
  {
    title: "Whiplash",
    description: "An intense drama about passion and perfection.",
    category: "movie" as const,
  },
  {
    title: "Spirited Away",
    description: "A surreal anime masterpiece about bravery and identity.",
    category: "movie" as const,
  },
];

const STATIC_GAMES = [
  {
    title: "Two truths and a dream",
    description: "Each share two truths and one future dream to guess.",
    category: "game" as const,
  },
  {
    title: "Emoji story relay",
    description: "Build a story one emoji at a time in chat.",
    category: "game" as const,
  },
];

const STATIC_MUSIC = [
  {
    title: "Shared playlist hour",
    description: "Each add three songs, then listen end-to-end together.",
    category: "music" as const,
  },
  {
    title: "Decade throwback",
    description: "Pick a decade and swap favorite tracks.",
    category: "music" as const,
  },
];

const STATIC_CHALLENGES = [
  {
    title: "24-hour kindness challenge",
    description: "Send three specific appreciations before tomorrow night.",
    category: "challenge" as const,
  },
  {
    title: "No-scroll dinner",
    description: "One meal together with phones away.",
    category: "challenge" as const,
  },
];

export function getRecommendations(
  recentMovies: string[],
  dominantMood: string,
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const recentLower = new Set(recentMovies.map((t) => t.toLowerCase()));

  let movieRec = STATIC_MOVIES[2]!;
  let reason = "A light shared watch to keep the ritual going.";
  if (dominantMood === "cuddles" || dominantMood === "happy") {
    movieRec = STATIC_MOVIES[1]!;
    reason = "Warm mood → heartwarming story night.";
  } else if (dominantMood === "space") {
    movieRec = STATIC_MOVIES[0]!;
    reason = "Space mood → expansive sci-fi together.";
  } else if (dominantMood === "excited") {
    movieRec = STATIC_MOVIES[3]!;
    reason = "High energy → intense shared watch.";
  } else if (dominantMood === "low") {
    movieRec = STATIC_MOVIES[4]!;
    reason = "Gentle wonder to lift a low day.";
  }

  if (!recentLower.has(movieRec.title.toLowerCase())) {
    recommendations.push({ ...movieRec, reason });
  } else {
    const alt = STATIC_MOVIES.find(
      (m) => !recentLower.has(m.title.toLowerCase()),
    );
    if (alt) recommendations.push({ ...alt, reason: "Fresh pick from your local catalog." });
  }

  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]!;
  recommendations.push({
    ...pick(STATIC_DATE_IDEAS),
    reason: "Offline time compounds connection.",
  });
  recommendations.push({
    ...pick(STATIC_CONVO_STARTERS),
    reason: "A local prompt — no external AI needed.",
  });
  recommendations.push({
    ...pick(STATIC_GAMES),
    reason: "Play keeps the bond light.",
  });
  recommendations.push({
    ...pick(STATIC_MUSIC),
    reason: "Shared soundtracks become shared memory.",
  });
  recommendations.push({
    ...pick(STATIC_CHALLENGES),
    reason: "Tiny challenges beat vague intentions.",
  });

  return recommendations;
}
