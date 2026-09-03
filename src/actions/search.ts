"use server";

import { and, desc, eq, ilike, lte, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  calendarEvents,
  memories,
  movieMemories,
  timeCapsules,
} from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { requireCoupleVerified } from "@/lib/couple-verification";

const searchSchema = z.object({
  query: z.string().trim().min(1, "Search query is required").max(100),
  category: z
    .enum(["all", "memories", "movies", "calendar", "capsules"])
    .default("all"),
});

export type SearchResultItemDTO = {
  id: string;
  category: "memories" | "movies" | "calendar" | "capsules";
  title: string;
  snippet: string | null;
  date: string;
  link: string;
};

export async function searchCoupleDataAction(
  input: unknown,
): Promise<ActionResult<{ results: SearchResultItemDTO[] }>> {
  try {
    const parsed = searchSchema.parse(input);
    const { user, couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);

    const { rateLimitOrThrow } = await import("@/lib/security");
    await rateLimitOrThrow({
      key: `rl:search:${user.id}`,
      limit: 30,
      windowSeconds: 60,
      message: "Too many search requests. Please slow down.",
    });

    const q = `%${parsed.query}%`;
    const results: SearchResultItemDTO[] = [];

    // Search Memories
    if (parsed.category === "all" || parsed.category === "memories") {
      const memRows = await db.query.memories.findMany({
        where: and(
          eq(memories.coupleId, couple.id),
          or(ilike(memories.caption, q), ilike(memories.eventLabel, q)),
        ),
        orderBy: [desc(memories.takenAt)],
        limit: 15,
      });

      for (const m of memRows) {
        results.push({
          id: `mem-${m.id}`,
          category: "memories",
          title: m.caption || "Photo Memory",
          snippet: m.eventLabel || "Captured Moment",
          date: m.takenAt.toISOString(),
          link: "/memories",
        });
      }
    }

    // Search Movie Memories
    if (parsed.category === "all" || parsed.category === "movies") {
      const movRows = await db.query.movieMemories.findMany({
        where: and(
          eq(movieMemories.coupleId, couple.id),
          ilike(movieMemories.title, q),
        ),
        orderBy: [desc(movieMemories.date)],
        limit: 15,
      });

      for (const mm of movRows) {
        results.push({
          id: `mov-${mm.id}`,
          category: "movies",
          title: mm.title,
          snippet: `Watched Together · ${mm.watchDuration}m`,
          date: mm.date.toISOString(),
          link: "/together",
        });
      }
    }

    // Search Calendar Events
    if (parsed.category === "all" || parsed.category === "calendar") {
      const calRows = await db.query.calendarEvents.findMany({
        where: and(
          eq(calendarEvents.coupleId, couple.id),
          or(
            ilike(calendarEvents.title, q),
            ilike(calendarEvents.description, q),
          ),
        ),
        orderBy: [desc(calendarEvents.eventDate)],
        limit: 15,
      });

      for (const c of calRows) {
        results.push({
          id: `cal-${c.id}`,
          category: "calendar",
          title: c.title,
          snippet: c.description || c.category,
          date: c.eventDate.toISOString(),
          link: "/calendar",
        });
      }
    }

    // Search Time Capsules (only search message text if capsule is unlocked)
    if (parsed.category === "all" || parsed.category === "capsules") {
      const now = new Date();
      const capRows = await db.query.timeCapsules.findMany({
        where: and(
          eq(timeCapsules.coupleId, couple.id),
          or(
            ilike(timeCapsules.title, q),
            and(
              or(eq(timeCapsules.isUnlocked, true), lte(timeCapsules.unlockAt, now)),
              ilike(timeCapsules.message, q),
            ),
          ),
        ),
        orderBy: [desc(timeCapsules.createdAt)],
        limit: 15,
      });

      for (const tc of capRows) {
        const canViewMessage = tc.isUnlocked || tc.unlockAt <= now;
        results.push({
          id: `cap-${tc.id}`,
          category: "capsules",
          title: tc.title,
          snippet: canViewMessage
            ? tc.message.slice(0, 80) + "…"
            : "Locked until " + tc.unlockAt.toLocaleDateString(),
          date: tc.createdAt.toISOString(),
          link: "/timeline",
        });
      }
    }

    // Sort results by date descending
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return ok({ results });
  } catch (e) {
    return fail(e);
  }
}
