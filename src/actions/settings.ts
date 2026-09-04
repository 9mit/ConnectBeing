"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { couples, roomCustomizations } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { createId } from "@/lib/ids";
import { ROOM_THEMES } from "@/lib/themes";

const updateSettingsSchema = z.object({
  theme: z.enum(ROOM_THEMES).optional(),
  petName: z.string().trim().min(1).max(40).optional(),
  decor: z.record(z.string(), z.unknown()).optional(),
});

export type CoupleSettingsDTO = {
  theme: string;
  petName: string;
  decor: Record<string, unknown>;
  coupleId: string;
};

export async function getCoupleSettingsAction(): Promise<
  ActionResult<CoupleSettingsDTO>
> {
  try {
    const { couple } = await requireActiveCouple();

    const room = await db.query.roomCustomizations.findFirst({
      where: eq(roomCustomizations.coupleId, couple.id),
    });

    return ok({
      theme: room?.theme || "rose-dusk",
      petName: couple.petName,
      decor: (room?.decor as Record<string, unknown>) || {},
      coupleId: couple.id,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function updateCoupleSettingsAction(
  input: unknown,
): Promise<ActionResult<{ updated: true }>> {
  try {
    const parsed = updateSettingsSchema.parse(input);
    const { couple } = await requireActiveCouple();

    if (parsed.petName) {
      await db
        .update(couples)
        .set({ petName: parsed.petName })
        .where(eq(couples.id, couple.id));
    }

    if (parsed.theme || parsed.decor) {
      const existingRoom = await db.query.roomCustomizations.findFirst({
        where: eq(roomCustomizations.coupleId, couple.id),
      });

      if (!existingRoom) {
        await db.insert(roomCustomizations).values({
          id: createId(),
          coupleId: couple.id,
          theme: parsed.theme || "rose-dusk",
          decor: parsed.decor || {},
        });
      } else {
        await db
          .update(roomCustomizations)
          .set({
            ...(parsed.theme ? { theme: parsed.theme } : {}),
            ...(parsed.decor ? { decor: parsed.decor } : {}),
            updatedAt: new Date(),
          })
          .where(eq(roomCustomizations.id, existingRoom.id));
      }
    }

    return ok({ updated: true });
  } catch (e) {
    return fail(e);
  }
}
