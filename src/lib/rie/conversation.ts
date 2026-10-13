import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { messages } from "@/db/schema";

export interface ConversationStats {
  messageCount: number;
  avgLength: number;
  emojiFrequency: number;
  questionRatio: number;
  silenceGaps: number;
  mutualParticipation: number;
  initiationBalance: number;
}

function approxEmojiCount(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    // Surrogate pairs often indicate emoji / non-BMP symbols in ciphertext-safe proxy.
    if (code >= 0xd800 && code <= 0xdbff) count += 1;
  }
  return count;
}

/** Aggregates only — never stores or returns message plaintext. */
export async function analyzeConversation(
  coupleId: string,
): Promise<ConversationStats> {
  const rows = await db.query.messages.findMany({
    where: eq(messages.coupleId, coupleId),
    orderBy: [asc(messages.createdAt)],
    limit: 200,
  });

  const textRows = rows.filter((m) => m.type === "text" && m.content);
  const messageCount = textRows.length;
  if (messageCount === 0) {
    return {
      messageCount: 0,
      avgLength: 0,
      emojiFrequency: 0,
      questionRatio: 0,
      silenceGaps: 0,
      mutualParticipation: 0.5,
      initiationBalance: 0.5,
    };
  }

  let totalLen = 0;
  let emojiHits = 0;
  let questions = 0;
  let silenceGaps = 0;
  const bySender = new Map<string, number>();
  let initiationsA = 0;
  let initiationsB = 0;
  let lastSender: string | null = null;
  let gapAnchor: Date | null = null;

  const senders = Array.from(new Set(textRows.map((m) => m.senderId)));
  const a = senders[0] ?? "";
  const b = senders[1] ?? a;

  for (const m of textRows) {
    // Ciphertext length is still a useful activity proxy without decrypting.
    const len = m.content?.length ?? 0;
    totalLen += len;
    const isCipher = Boolean(m.content?.startsWith("e2ee:"));
    if (!isCipher && m.content) {
      if (approxEmojiCount(m.content) > 0) emojiHits += 1;
      if (m.content.includes("?")) questions += 1;
    }
    bySender.set(m.senderId, (bySender.get(m.senderId) ?? 0) + 1);

    if (gapAnchor) {
      const gapMin =
        (m.createdAt.getTime() - gapAnchor.getTime()) / 60000;
      if (gapMin > 180) silenceGaps += 1;
    }
    gapAnchor = m.createdAt;

    if (lastSender !== m.senderId) {
      if (m.senderId === a) initiationsA += 1;
      else if (m.senderId === b) initiationsB += 1;
    }
    lastSender = m.senderId;
  }

  const countA = bySender.get(a) ?? 0;
  const countB = bySender.get(b) ?? 0;
  const total = countA + countB || 1;
  const mutualParticipation = Math.min(countA, countB) / total;
  const initTotal = initiationsA + initiationsB || 1;
  const initiationBalance = Math.min(initiationsA, initiationsB) / initTotal;

  return {
    messageCount,
    avgLength: totalLen / messageCount,
    emojiFrequency: emojiHits / messageCount,
    questionRatio: questions / messageCount,
    silenceGaps,
    mutualParticipation,
    initiationBalance,
  };
}
