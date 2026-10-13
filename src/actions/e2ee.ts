"use server";

import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { userDevices, userKeyEscrow, users } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { rateLimitOrThrow } from "@/lib/security";

const publicKeySchema = z.object({
  publicKey: z.string().min(32).max(4096),
});

const registerDeviceSchema = z.object({
  deviceId: z.string().trim().min(8).max(128),
  deviceName: z.string().trim().min(1).max(100),
  publicKey: z.string().trim().min(32).max(4096),
});

const revokeDeviceSchema = z.object({
  deviceId: z.string().trim().min(8).max(128),
});

const saveKeyEscrowSchema = z.object({
  deviceId: z.string().trim().min(8).max(128),
  encryptedKeyPackage: z.string().trim().min(32).max(16384),
});

export type DeviceInfoDTO = {
  id: string;
  deviceId: string;
  deviceName: string;
  publicKeySpki: string;
  createdAt: string;
  lastSeenAt: string;
  isRevoked: boolean;
  isCurrent?: boolean;
};

// ---------------------------------------------------------------------------
// Legacy Single-Key Compatibility Actions
// ---------------------------------------------------------------------------

export async function publishE2eePublicKeyAction(
  input: unknown,
): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const parsed = publicKeySchema.parse(input);
    const { user } = await requireActiveCouple();
    await db
      .update(users)
      .set({ e2eePublicKey: parsed.publicKey, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return ok({ saved: true });
  } catch (e) {
    return fail(e);
  }
}

export async function getPartnerE2eePublicKeyAction(): Promise<
  ActionResult<{ publicKey: string | null; partnerId: string | null }>
> {
  try {
    const { user, couple } = await requireActiveCouple();
    const partnerId =
      couple.userAId === user.id ? couple.userBId : couple.userAId;
    const partner = await db.query.users.findFirst({
      where: and(eq(users.id, partnerId), ne(users.id, user.id)),
    });
    if (!partner) {
      throw new AppError("NOT_FOUND", "Partner not found.", 404);
    }
    return ok({
      publicKey: partner.e2eePublicKey ?? null,
      partnerId: partner.id,
    });
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Multi-Device Enrollment & Management Actions
// ---------------------------------------------------------------------------

export async function registerDeviceAction(
  input: unknown,
): Promise<ActionResult<{ registered: boolean; deviceId: string }>> {
  try {
    const parsed = registerDeviceSchema.parse(input);
    const { user } = await requireActiveCouple();

    await rateLimitOrThrow({
      key: `rl:e2ee:reg:${user.id}`,
      limit: 20,
      windowSeconds: 60 * 15,
      message: "Too many device registrations. Please slow down.",
    });

    const existing = await db.query.userDevices.findFirst({
      where: and(
        eq(userDevices.userId, user.id),
        eq(userDevices.deviceId, parsed.deviceId),
      ),
    });

    const now = new Date();
    if (existing) {
      await db
        .update(userDevices)
        .set({
          deviceName: parsed.deviceName,
          publicKey: parsed.publicKey,
          lastSeenAt: now,
          revokedAt: null, // Re-activate if re-enrolled
        })
        .where(eq(userDevices.id, existing.id));
    } else {
      await db.insert(userDevices).values({
        id: createId(),
        userId: user.id,
        deviceId: parsed.deviceId,
        deviceName: parsed.deviceName,
        publicKey: parsed.publicKey,
        createdAt: now,
        lastSeenAt: now,
        revokedAt: null,
      });
    }

    // Update primary key in users table for backward compatibility
    await db
      .update(users)
      .set({ e2eePublicKey: parsed.publicKey, updatedAt: now })
      .where(eq(users.id, user.id));

    return ok({ registered: true, deviceId: parsed.deviceId });
  } catch (e) {
    return fail(e);
  }
}

export async function getCoupleActiveDevicesAction(): Promise<
  ActionResult<{
    myDevices: DeviceInfoDTO[];
    partnerDevices: DeviceInfoDTO[];
    partnerId: string;
  }>
> {
  try {
    const { user, couple } = await requireActiveCouple();
    const partnerId =
      couple.userAId === user.id ? couple.userBId : couple.userAId;

    const [myRows, partnerRows] = await Promise.all([
      db.query.userDevices.findMany({
        where: and(
          eq(userDevices.userId, user.id),
          isNull(userDevices.revokedAt),
        ),
        orderBy: [desc(userDevices.lastSeenAt)],
      }),
      db.query.userDevices.findMany({
        where: and(
          eq(userDevices.userId, partnerId),
          isNull(userDevices.revokedAt),
        ),
        orderBy: [desc(userDevices.lastSeenAt)],
      }),
    ]);

    const toDto = (d: typeof userDevices.$inferSelect): DeviceInfoDTO => ({
      id: d.id,
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      publicKeySpki: d.publicKey,
      createdAt: d.createdAt.toISOString(),
      lastSeenAt: d.lastSeenAt.toISOString(),
      isRevoked: Boolean(d.revokedAt),
    });

    return ok({
      myDevices: myRows.map(toDto),
      partnerDevices: partnerRows.map(toDto),
      partnerId,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function revokeDeviceAction(
  input: unknown,
): Promise<ActionResult<{ revoked: boolean }>> {
  try {
    const parsed = revokeDeviceSchema.parse(input);
    const { user } = await requireActiveCouple();

    const existing = await db.query.userDevices.findFirst({
      where: and(
        eq(userDevices.userId, user.id),
        eq(userDevices.deviceId, parsed.deviceId),
      ),
    });

    if (!existing) {
      throw new AppError("NOT_FOUND", "Device not found.", 404);
    }

    await db
      .update(userDevices)
      .set({ revokedAt: new Date() })
      .where(eq(userDevices.id, existing.id));

    return ok({ revoked: true });
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Client-Side Zero-Knowledge Key Escrow Actions
// ---------------------------------------------------------------------------

export async function saveKeyEscrowAction(
  input: unknown,
): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const parsed = saveKeyEscrowSchema.parse(input);
    const { user } = await requireActiveCouple();

    await rateLimitOrThrow({
      key: `rl:e2ee:escrow:${user.id}`,
      limit: 10,
      windowSeconds: 60 * 15,
      message: "Too many key backup requests. Please slow down.",
    });

    const existing = await db.query.userKeyEscrow.findFirst({
      where: and(
        eq(userKeyEscrow.userId, user.id),
        eq(userKeyEscrow.deviceId, parsed.deviceId),
      ),
    });

    const now = new Date();
    if (existing) {
      await db
        .update(userKeyEscrow)
        .set({
          encryptedKeyPackage: parsed.encryptedKeyPackage,
          updatedAt: now,
        })
        .where(eq(userKeyEscrow.id, existing.id));
    } else {
      await db.insert(userKeyEscrow).values({
        id: createId(),
        userId: user.id,
        deviceId: parsed.deviceId,
        encryptedKeyPackage: parsed.encryptedKeyPackage,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    return ok({ saved: true });
  } catch (e) {
    return fail(e);
  }
}

export async function getKeyEscrowAction(
  deviceId: string,
): Promise<ActionResult<{ encryptedKeyPackage: string | null }>> {
  try {
    const cleanDeviceId = z.string().trim().min(8).max(128).parse(deviceId);
    const { user } = await requireActiveCouple();

    const escrow = await db.query.userKeyEscrow.findFirst({
      where: and(
        eq(userKeyEscrow.userId, user.id),
        eq(userKeyEscrow.deviceId, cleanDeviceId),
      ),
    });

    return ok({
      encryptedKeyPackage: escrow?.encryptedKeyPackage ?? null,
    });
  } catch (e) {
    return fail(e);
  }
}
