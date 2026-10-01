"use server";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { doodleCanvases, type DoodleCanvas } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { createId } from "@/lib/ids";
import {
  clearDoodleCanvasSchema,
  saveDoodleCanvasSchema,
} from "@/lib/validations";

/**
 * Fetch the shared persistent doodle canvas for the active couple.
 * Authenticated and couple-scoped.
 */
export async function getDoodleCanvasAction(): Promise<
  ActionResult<{ canvas: DoodleCanvas | null }>
> {
  try {
    const { couple } = await requireActiveCouple();

    const canvas = await db.query.doodleCanvases.findFirst({
      where: eq(doodleCanvases.coupleId, couple.id),
    });

    return ok({ canvas: canvas ?? null });
  } catch (error) {
    return fail(error);
  }
}

/**
 * Save / checkpoint the collaborative doodle canvas state.
 * Debounced from the client to prevent excessive database writes.
 * Atomic upsert via onConflictDoUpdate guarantees concurrency safety.
 */
export async function saveDoodleCanvasAction(
  input: unknown,
): Promise<ActionResult<{ success: boolean; version: number }>> {
  try {
    const { user, couple } = await requireActiveCouple();
    const parsed = saveDoodleCanvasSchema.parse(input);

    const { rateLimitOrThrow } = await import("@/lib/security");
    await rateLimitOrThrow({
      key: `rl:doodle:save:${user.id}`,
      limit: 120,
      windowSeconds: 60,
      message: "Too many doodle save requests. Please slow down.",
    });

    const [saved] = await db
      .insert(doodleCanvases)
      .values({
        id: createId(),
        coupleId: couple.id,
        strokes: parsed.strokes,
        snapshot: parsed.snapshot ?? null,
        version: 1,
        lastDrawnById: user.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: doodleCanvases.coupleId,
        set: {
          strokes: parsed.strokes,
          snapshot: parsed.snapshot ?? null,
          version: sql`${doodleCanvases.version} + 1`,
          lastDrawnById: user.id,
          updatedAt: new Date(),
        },
      })
      .returning({ version: doodleCanvases.version });

    return ok({ success: true, version: saved?.version ?? 1 });
  } catch (error) {
    return fail(error);
  }
}

/**
 * Clear the collaborative doodle canvas for the couple.
 * Requires explicit client confirmation.
 */
export async function clearDoodleCanvasAction(
  input: unknown,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, couple } = await requireActiveCouple();
    clearDoodleCanvasSchema.parse(input);

    const { rateLimitOrThrow } = await import("@/lib/security");
    await rateLimitOrThrow({
      key: `rl:doodle:clear:${user.id}`,
      limit: 20,
      windowSeconds: 60,
      message: "Too many clear requests. Please slow down.",
    });

    await db
      .insert(doodleCanvases)
      .values({
        id: createId(),
        coupleId: couple.id,
        strokes: [],
        snapshot: null,
        version: 1,
        lastDrawnById: user.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: doodleCanvases.coupleId,
        set: {
          strokes: [],
          snapshot: null,
          version: sql`${doodleCanvases.version} + 1`,
          lastDrawnById: user.id,
          updatedAt: new Date(),
        },
      });

    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}

