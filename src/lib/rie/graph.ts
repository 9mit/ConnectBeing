import { eq } from "drizzle-orm";

import { db } from "@/db";
import { couples, users, watchSessions, memories, moods } from "@/db/schema";

export interface GraphNode {
  id: string;
  type: "user" | "activity" | "movie" | "place" | "memory" | "mood" | "event" | "date" | "goal";
  label: string;
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "watched" | "visited" | "discussed" | "liked" | "shared" | "planned" | "celebrated" | "completed";
  weight: number;
}

export interface RelationshipGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export async function buildRelationshipGraph(coupleId: string): Promise<RelationshipGraph> {
  const couple = await db.query.couples.findFirst({
    where: eq(couples.id, coupleId),
  });

  if (!couple) {
    return { nodes: [], edges: [] };
  }

  const partners = await db.query.users.findMany({
    where: eq(users.coupleId, coupleId),
  });

  const moviesList = await db.query.watchSessions.findMany({
    where: eq(watchSessions.coupleId, coupleId),
  });

  const memoriesList = await db.query.memories.findMany({
    where: eq(memories.coupleId, coupleId),
  });

  const moodsList = await db.query.moods.findMany({
    where: eq(moods.coupleId, coupleId),
  });

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const partner of partners) {
    nodes.push({
      id: partner.id,
      type: "user",
      label: partner.email || "Partner",
    });
  }

  // Add Movies & Edges
  for (const movie of moviesList) {
    const movieId = `movie-${movie.id}`;
    nodes.push({
      id: movieId,
      type: "movie",
      label: movie.title,
      properties: { provider: movie.provider },
    });

    // Link users who watched
    for (const partner of partners) {
      edges.push({
        source: partner.id,
        target: movieId,
        type: movie.status === "completed" ? "watched" : "planned",
        weight: 1.0,
      });
    }
  }

  // Add Memories & Edges
  for (const mem of memoriesList) {
    const memNodeId = `memory-${mem.id}`;
    nodes.push({
      id: memNodeId,
      type: "memory",
      label: mem.caption || "A sweet memory",
    });

    edges.push({
      source: mem.uploaderId,
      target: memNodeId,
      type: "shared",
      weight: 1.0,
    });
  }

  // Add Moods & Edges
  for (const m of moodsList) {
    const moodNodeId = `mood-${m.id}`;
    nodes.push({
      id: moodNodeId,
      type: "mood",
      label: m.mood,
    });

    edges.push({
      source: m.userId,
      target: moodNodeId,
      type: "completed", // logged mood is a completed action
      weight: 0.5,
    });
  }

  return { nodes, edges };
}
