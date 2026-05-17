import { and, eq } from "drizzle-orm";
import { db, tripsTable, tripSharesTable } from "@workspace/db";
import type { Trip } from "@workspace/db";

export type TripPermission = "owner" | "edit" | "view";

export interface TripAccess {
  trip: Trip;
  permission: TripPermission;
}

export async function getTripAccess(
  tripId: number,
  userId: number
): Promise<TripAccess | null> {
  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.id, tripId));

  if (!trip) return null;

  if (trip.ownerId === userId) {
    return { trip, permission: "owner" };
  }

  const [share] = await db
    .select()
    .from(tripSharesTable)
    .where(
      and(
        eq(tripSharesTable.tripId, tripId),
        eq(tripSharesTable.userId, userId)
      )
    );

  if (!share) return null;

  return { trip, permission: share.permission as TripPermission };
}
