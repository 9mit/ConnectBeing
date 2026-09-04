"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { roomCustomizations } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { createId } from "@/lib/ids";
import { ROOM_THEMES } from "@/lib/themes";
import { z } from "zod";

const updateSchema = z.object({
  theme: z.enum(ROOM_THEMES).optional(),
  decor: z
    .object({
      plants: z.boolean().optional(),
      candles: z.boolean().optional(),
      fairyLights: z.boolean().optional(),
      cushions: z.boolean().optional(),
    })
    .optional(),
});

export async function getRoomCustomizationAction(): Promise<
  ActionResult<{
    theme: string;
    decor: Record<string, unknown>;
  }>
> {
  try {
    const { couple } = await requireActiveCouple();
    let row = await db.query.roomCustomizations.findFirst({
      where: eq(roomCustomizations.coupleId, couple.id),
    });
    if (!row) {
      const id = createId();
      await db.insert(roomCustomizations).values({
        id,
        coupleId: couple.id,
        theme: "rose-dusk",
        decor: { plants: true, candles: true, fairyLights: true, cushions: true },
      });
      row = await db.query.roomCustomizations.findFirst({
        where: eq(roomCustomizations.id, id),
      });
    }
    return ok({
      theme: row?.theme ?? "rose-dusk",
      decor: (row?.decor as Record<string, unknown>) ?? {},
    });
  } catch (e) {
    return fail(e);
  }
}

export async function updateRoomCustomizationAction(
  input: unknown,
): Promise<ActionResult<{ theme: string }>> {
  try {
    const parsed = updateSchema.parse(input);
    const { couple } = await requireActiveCouple();
    const existing = await db.query.roomCustomizations.findFirst({
      where: eq(roomCustomizations.coupleId, couple.id),
    });
    if (!existing) {
      await db.insert(roomCustomizations).values({
        id: createId(),
        coupleId: couple.id,
        theme: parsed.theme ?? "rose-dusk",
        decor: parsed.decor ?? {},
      });
    } else {
      await db
        .update(roomCustomizations)
        .set({
          theme: parsed.theme ?? existing.theme,
          decor: parsed.decor ?? existing.decor,
          updatedAt: new Date(),
        })
        .where(eq(roomCustomizations.id, existing.id));
    }
    return ok({ theme: parsed.theme ?? existing?.theme ?? "rose-dusk" });
  } catch (e) {
    return fail(e);
  }
}
