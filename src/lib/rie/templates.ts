import type { QuizQuestionData } from "./types";
import type { BehavioralMetrics } from "./behavior";
import type { ConversationStats } from "./conversation";
import type { MoodTrend } from "./mood-engine";

type QuizSeed = Omit<QuizQuestionData, "index">;

/** Offline relationship quiz knowledge base — no LLM. */
export const RELATIONSHIP_QUIZ_POOL: QuizSeed[] = [
  {
    question: "What is your partner's primary love language?",
    correct_answer: "Acts of Service",
    distractors: ["Words of Affirmation", "Physical Touch", "Quality Time"],
  },
  {
    question: "How does your partner prefer to spend a rainy day?",
    correct_answer: "Reading a book or watching movies indoors",
    distractors: ["Going out for a drive", "Working on their hobbies", "Sleeping all day"],
  },
  {
    question: "What is your partner's go-to comfort food?",
    correct_answer: "Pizza / Pasta",
    distractors: ["Ice Cream", "Burgers & Fries", "Home-cooked meal"],
  },
  {
    question: "Which habit does your partner wish you would improve?",
    correct_answer: "Being late",
    distractors: ["Leaving the lights on", "Too much phone time", "Interrupting while talking"],
  },
  {
    question: "What would your partner choose as a dream travel destination?",
    correct_answer: "Cozy mountain cabin",
    distractors: ["Sunny tropical beach", "Historic European city", "Bustling metropolis"],
  },
  {
    question: "How does your partner handle stress?",
    correct_answer: "Taking quiet time to process alone",
    distractors: ["Talking it out immediately", "Distracting with hobbies", "Exercising or venting"],
  },
  {
    question: "What is your partner's favorite shared memory so far?",
    correct_answer: "Our first trip together",
    distractors: ["The day we first met", "Quiet evenings at home", "Celebrating a milestone"],
  },
  {
    question: "What time of day is your partner most energetic?",
    correct_answer: "Morning",
    distractors: ["Afternoon", "Evening", "Late night"],
  },
  {
    question: "Which date vibe does your partner prefer?",
    correct_answer: "Home-cooked dinner and a movie",
    distractors: ["Crowded nightlife", "Adventure sports", "Shopping marathon"],
  },
  {
    question: "What compliment means the most to your partner?",
    correct_answer: "Feeling appreciated for everyday effort",
    distractors: ["Looks only", "Career status", "Social popularity"],
  },
  {
    question: "How does your partner like to celebrate wins?",
    correct_answer: "Quiet celebration together",
    distractors: ["Big public party", "Solo reward shopping", "Posting online"],
  },
  {
    question: "What is your partner's ideal weekend pace?",
    correct_answer: "Balanced rest and one plan",
    distractors: ["Fully packed schedule", "Total isolation", "Last-minute chaos"],
  },
  {
    question: "Which conflict style matches your partner best?",
    correct_answer: "Needs a pause, then a calm talk",
    distractors: ["Debate until resolved", "Avoid forever", "Joke it away only"],
  },
  {
    question: "What shared ritual matters most to your partner?",
    correct_answer: "Daily check-in messages",
    distractors: ["Matching outfits", "Public PDAs", "Expensive gifts"],
  },
  {
    question: "Which movie night snack would your partner pick?",
    correct_answer: "Popcorn",
    distractors: ["Spicy chips", "Only dessert", "Nothing at all"],
  },
];

export const ICEBREAKERS = [
  "What made you smile today?",
  "What is one small win from this week?",
  "If we had a free evening with no phones, what would we do?",
  "What song is stuck in your head right now?",
  "What is something you want us to try together this month?",
];

export const DEEP_QUESTIONS = [
  "When do you feel most supported by me?",
  "What fear do you want us to face together?",
  "What does a secure future with us look like to you?",
  "Which childhood habit still shows up in how you love?",
  "What boundary helps you feel safest with me?",
];

export const FUNNY_QUESTIONS = [
  "What is our most ridiculous shared habit?",
  "If we were a sitcom couple, what would the theme song be?",
  "What household chore do you pretend not to see?",
  "Which of us would survive a zombie apocalypse longer?",
  "What is the funniest misunderstanding we have had?",
];

export const FUTURE_PLANNING = [
  "Where should our next mini-trip be?",
  "What skill should we learn together this year?",
  "What tradition do you want us to start?",
  "How should we celebrate our next milestone?",
  "What home vibe are we building toward?",
];

export function getOfflineQuizQuestions(count = 3): QuizQuestionData[] {
  const shuffled = [...RELATIONSHIP_QUIZ_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((q, i) => ({
    index: i,
    question: q.question,
    correct_answer: q.correct_answer,
    distractors: q.distractors,
  }));
}

export function pickDiscussionQuestions(count = 3): string[] {
  const pool = [
    ...ICEBREAKERS,
    ...DEEP_QUESTIONS,
    ...FUNNY_QUESTIONS,
    ...FUTURE_PLANNING,
  ];
  return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
}

export function generateMovieDiscussionPrompts(
  title: string,
  genreOrProvider: string,
): string[] {
  const g = genreOrProvider.toLowerCase();

  if (g.includes("sci") || g.includes("space") || g.includes("fiction")) {
    return [
      `What idea in "${title}" challenged how you see the future?`,
      `If you lived in the world of "${title}", what role would you choose?`,
      `Did "${title}" make you feel hopeful, uneasy, or both?`,
    ];
  }
  if (g.includes("romance") || g.includes("rom")) {
    return [
      `Which relationship moment in "${title}" felt most real?`,
      `What would you have done differently than the couple in "${title}"?`,
      `Which scene made you feel closest while watching "${title}"?`,
    ];
  }
  if (g.includes("horror") || g.includes("thriller")) {
    return [
      `What was the scariest beat in "${title}" for you?`,
      `Would you rewatch "${title}" alone, or only together?`,
      `What fear did "${title}" play with most effectively?`,
    ];
  }
  if (g.includes("comedy") || g.includes("funny")) {
    return [
      `What was the funniest scene in "${title}"?`,
      `Which character in "${title}" felt most like one of us?`,
      `Would you recommend "${title}" for a light date night?`,
    ];
  }

  return [
    `What was your favorite scene in "${title}"?`,
    `What felt like the core message of "${title}"?`,
    `Would you change the ending of "${title}"?`,
  ];
}

export function generateDailyInsights(
  metrics: BehavioralMetrics,
  conversation?: ConversationStats,
  mood?: MoodTrend,
): string[] {
  const insights: string[] = [];

  if (metrics.avgMessagesPerDay > 30) {
    insights.push("You both watched the chat closely — over 30 messages a day on average.");
  } else if (metrics.avgMessagesPerDay < 5) {
    insights.push("Things have been quieter lately. A short check-in can reopen the thread.");
  }

  if (metrics.conversationBalance > 0.4 && metrics.conversationBalance < 0.6) {
    insights.push("Your chat participation is balanced — a healthy mutual rhythm.");
  } else if (metrics.conversationBalance < 0.3) {
    insights.push("One of you is carrying most of the chat. Invite the quieter voice in.");
  }

  if (metrics.movieFrequencyPerWeek >= 2) {
    insights.push("You watched together often this stretch — shared screens build shared lore.");
  }

  if (metrics.avgVoiceCallMinutes >= 20) {
    insights.push(`You averaged about ${Math.round(metrics.avgVoiceCallMinutes)} voice minutes a day.`);
  }

  if (metrics.nightActivityRatio > 0.6) {
    insights.push("Most of your spark shows up at night — you are night-connection people.");
  } else if (metrics.morningActivityRatio > 0.6) {
    insights.push("You connect most in the morning — a strong start-of-day ritual.");
  }

  if (conversation && conversation.questionRatio > 0.25) {
    insights.push("Your chats include lots of questions — curiosity is high.");
  }
  if (conversation && conversation.silenceGaps > 5) {
    insights.push("There were several quiet gaps. A planned evening can reconnect the thread.");
  }

  if (mood?.happyStreakDays && mood.happyStreakDays >= 3) {
    insights.push(`Happy mood streak: ${mood.happyStreakDays} days.`);
  }
  if (mood?.lowPeriod) {
    insights.push("Moods dipped recently. A soft check-in or low-pressure date can help.");
  }

  if (insights.length === 0) {
    insights.push("You kept a steady daily connection. Small shared moments still compound.");
  }

  return insights.slice(0, 5);
}

export function generateConflictMediation(tensionHint?: string): {
  steps: string[];
  prompt: string;
} {
  return {
    steps: [
      "Pause for 10 minutes without debating.",
      "Each person names one feeling (not a blame).",
      "Each person names one need.",
      "Agree on one tiny next step for today.",
    ],
    prompt: tensionHint
      ? `Talk about "${tensionHint}" using feeling → need → one next step.`
      : "Share one feeling and one need, then pick one tiny repair action.",
  };
}
