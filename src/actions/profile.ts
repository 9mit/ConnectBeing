"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { couples, onboardingProfiles, users } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { daysBetween, formatDaysTogether } from "@/lib/format";

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  avatarUrl: z.string().url().or(z.string().length(0)).optional(),
  selfDescription: z.string().trim().max(500).optional(),
  partnerExpectation: z.string().trim().max(500).optional(),
  hobbies: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  loveLanguages: z.array(z.string().trim().min(1).max(40)).max(5).optional(),
});

const updateAnniversarySchema = z.object({
  anniversaryDate: z.string().datetime(),
});

export type ProfileDTO = {
  id: string;
  name: string;
  avatarUrl: string | null;
  age: number;
  gender: string;
  hobbies: string[];
  selfDescription: string;
  partnerExpectation: string;
  loveLanguages: string[];
  email: string;
};

export type CoupleProfileDataDTO = {
  me: ProfileDTO;
  partner: ProfileDTO | null;
  anniversaryDate: string | null;
  daysTogether: number;
  daysTogetherLabel: string;
  petName: string;
  petState: string;
  status: string;
};

export async function getCoupleProfilesAction(): Promise<
  ActionResult<CoupleProfileDataDTO>
> {
  try {
    const { user, couple } = await requireActiveCouple();

    const partnerId =
      couple.userAId === user.id ? couple.userBId : couple.userAId;

    const [myProfileRow, partnerUserRow] = await Promise.all([
      db.query.onboardingProfiles.findFirst({
        where: eq(onboardingProfiles.userId, user.id),
      }),
      db.query.users.findFirst({
        where: eq(users.id, partnerId),
        with: { onboardingProfile: true },
      }),
    ]);

    const me: ProfileDTO = {
      id: user.id,
      name: myProfileRow?.name || "You",
      avatarUrl: myProfileRow?.avatarUrl || null,
      age: myProfileRow?.age || 0,
      gender: myProfileRow?.gender || "not specified",
      hobbies: myProfileRow?.hobbies || [],
      selfDescription: myProfileRow?.selfDescription || "",
      partnerExpectation: myProfileRow?.partnerExpectation || "",
      loveLanguages: myProfileRow?.loveLanguages || [],
      email: user.email,
    };

    const partnerProfile = partnerUserRow?.onboardingProfile;
    const partner: ProfileDTO | null = partnerUserRow
      ? {
          id: partnerUserRow.id,
          name: partnerProfile?.name || "Partner",
          avatarUrl: partnerProfile?.avatarUrl || null,
          age: partnerProfile?.age || 0,
          gender: partnerProfile?.gender || "not specified",
          hobbies: partnerProfile?.hobbies || [],
          selfDescription: partnerProfile?.selfDescription || "",
          partnerExpectation: partnerProfile?.partnerExpectation || "",
          loveLanguages: partnerProfile?.loveLanguages || [],
          email: partnerUserRow.email,
        }
      : null;

    const togetherSince = couple.anniversaryDate ?? couple.createdAt;
    const days = daysBetween(togetherSince);

    return ok({
      me,
      partner,
      anniversaryDate: couple.anniversaryDate?.toISOString() ?? null,
      daysTogether: days,
      daysTogetherLabel: formatDaysTogether(days),
      petName: couple.petName,
      petState: couple.petState,
      status: couple.status,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function updateProfileAction(
  input: unknown,
): Promise<ActionResult<{ updated: true }>> {
  try {
    const parsed = updateProfileSchema.parse(input);
    const { user } = await requireActiveCouple();

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (parsed.name !== undefined) updateFields.name = parsed.name;
    if (parsed.avatarUrl !== undefined) updateFields.avatarUrl = parsed.avatarUrl || null;
    if (parsed.selfDescription !== undefined) updateFields.selfDescription = parsed.selfDescription;
    if (parsed.partnerExpectation !== undefined) updateFields.partnerExpectation = parsed.partnerExpectation;
    if (parsed.hobbies !== undefined) updateFields.hobbies = parsed.hobbies;
    if (parsed.loveLanguages !== undefined) updateFields.loveLanguages = parsed.loveLanguages;

    await db
      .update(onboardingProfiles)
      .set(updateFields)
      .where(eq(onboardingProfiles.userId, user.id));

    return ok({ updated: true });
  } catch (e) {
    return fail(e);
  }
}

export async function updateAnniversaryAction(
  input: unknown,
): Promise<ActionResult<{ anniversaryDate: string }>> {
  try {
    const parsed = updateAnniversarySchema.parse(input);
    const { couple } = await requireActiveCouple();

    const date = new Date(parsed.anniversaryDate);
    await db
      .update(couples)
      .set({ anniversaryDate: date })
      .where(eq(couples.id, couple.id));

    return ok({ anniversaryDate: date.toISOString() });
  } catch (e) {
    return fail(e);
  }
}
