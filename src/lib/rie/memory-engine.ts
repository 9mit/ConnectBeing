import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { memories, movieMemories, userAchievements } from "@/db/schema";

export interface MemoryIndexItem {
  id: string;
  kind: "photo" | "movie" | "achievement";
  title: string;
  at: string;
  tags: string[];
}

/** Local searchable memory index — no external APIs. */
export async function buildMemoryIndex(
  coupleId: string,
): Promise<MemoryIndexItem[]> {
  const [photos, movies, unlocks] = await Promise.all([
    db.query.memories.findMany({
      where: eq(memories.coupleId, coupleId),
      orderBy: [desc(memories.takenAt)],
      limit: 100,
    }),
    db.query.movieMemories.findMany({
      where: eq(movieMemories.coupleId, coupleId),
      orderBy: [desc(movieMemories.date)],
      limit: 50,
    }),
    db.query.userAchievements.findMany({
      where: eq(userAchievements.coupleId, coupleId),
      limit: 50,
    }),
  ]);

  const items: MemoryIndexItem[] = [
    ...photos.map((p) => ({
      id: p.id,
      kind: "photo" as const,
      title: p.eventLabel || p.caption || "Photo memory",
      at: p.takenAt.toISOString(),
      tags: [p.eventLabel, p.caption].filter(Boolean) as string[],
    })),
    ...movies.map((m) => ({
      id: m.id,
      kind: "movie" as const,
      title: m.title,
      at: m.date.toISOString(),
      tags: ["movie", "together", `${m.watchDuration}m`],
    })),
    ...unlocks.map((u) => ({
      id: u.id,
      kind: "achievement" as const,
      title: "Achievement unlocked",
      at: u.unlockedAt.toISOString(),
      tags: ["achievement"],
    })),
  ];

  return items.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

export function searchMemoryIndex(
  items: MemoryIndexItem[],
  query: string,
): MemoryIndexItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (i) =>
      i.title.toLowerCase().includes(q) ||
      i.tags.some((t) => t.toLowerCase().includes(q)) ||
      i.kind.includes(q),
  );
}
