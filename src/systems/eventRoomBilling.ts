/**
 * Event room billing system — charges VX coins per hour for event-type voice rooms.
 */
export interface EventRoom {
  id: string;
  type: string;
  lastCharge: number;
  ownerId: string;
}

export interface UserWallet {
  coins: number;
}

const HOUR_MS = 60 * 60 * 1000;
const EVENT_HOURLY_COST = 5000;

/**
 * Check and charge for ongoing event rooms.
 * Throws if user doesn't have enough coins.
 */
export function chargeEventRoom(room: EventRoom, wallet: UserWallet): boolean {
  if (room.type !== "event") return false;

  const now = Date.now();
  if (now - room.lastCharge < HOUR_MS) return false; // Not due yet

  if (wallet.coins < EVENT_HOURLY_COST) {
    throw new Error("Not enough coins for next hour");
  }

  wallet.coins -= EVENT_HOURLY_COST;
  room.lastCharge = now;
  return true;
}

export function getEventRoomCost(): number {
  return EVENT_HOURLY_COST;
}
