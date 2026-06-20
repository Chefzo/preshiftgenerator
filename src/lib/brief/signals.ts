import type {
  FirstTimer,
  Guest,
  HeadlineStats,
  PacingBucket,
  Reservation,
  TicketStat,
  WhiteGloveFlag,
} from "@/lib/types";

/**
 * Pure signal-derivation helpers. No I/O — given normalized data, they compute
 * the things that make a brief sharp. Heavily unit-tested because this is where
 * the product's intelligence lives.
 */

const ACTIVE: Reservation["status"][] = ["booked", "confirmed", "seated"];

export function activeReservations(reservations: Reservation[]): Reservation[] {
  return reservations.filter((r) => ACTIVE.includes(r.status));
}

/** "HH:MM" → minutes since midnight. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function fmt(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * A reservation is a first-timer if its channel is Google, or its guest is new
 * (visitCount at/below the configured ceiling, or no guest record at all).
 */
export function isFirstTimer(
  res: Reservation,
  guest: Guest | undefined,
  visitCeiling: number,
): boolean {
  if (res.channel === "google") return true;
  if (!res.guestId) return false; // anonymous walk-in, not a tracked first-timer
  if (!guest) return true;
  return !guest.isRegular && guest.visitCount <= visitCeiling;
}

export function firstTimers(
  reservations: Reservation[],
  guestsById: Map<string, Guest>,
  visitCeiling: number,
): FirstTimer[] {
  return activeReservations(reservations)
    .filter((r) => isFirstTimer(r, r.guestId ? guestsById.get(r.guestId) : undefined, visitCeiling))
    .map((r) => ({
      guestName: r.guestId ? guestsById.get(r.guestId)?.name : undefined,
      partySize: r.partySize,
      time: r.time,
      channel: r.channel,
    }))
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
}

/**
 * White-glove flags: a regular whose most recent ticket time exceeded the
 * threshold gets called out so the floor can pre-empt a repeat of a slow night.
 * Ticket time is taken from per-guest TicketStats first, then the guest record.
 */
export function whiteGloveFlags(
  reservations: Reservation[],
  guestsById: Map<string, Guest>,
  ticketByGuest: Map<string, number>,
  thresholdMinutes: number,
): WhiteGloveFlag[] {
  const flags: WhiteGloveFlag[] = [];
  for (const res of activeReservations(reservations)) {
    if (!res.guestId) continue;
    const guest = guestsById.get(res.guestId);
    if (!guest || !guest.isRegular) continue;

    const ticket = ticketByGuest.get(res.guestId) ?? guest.lastVisitTicketMinutes;
    if (ticket !== undefined && ticket > thresholdMinutes) {
      flags.push({
        guestName: guest.name,
        reason: `Last visit ran a ${ticket}-min ticket — get ahead of it tonight`,
        lastVisitTicketMinutes: ticket,
        notes: guest.preferences.join("; ") || undefined,
      });
    }
  }
  return flags;
}

/** Bucket reservations into pacing windows of the given width. */
export function pacing(
  reservations: Reservation[],
  startTime: string,
  endTime: string,
  bucketMinutes: number,
): PacingBucket[] {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const buckets: PacingBucket[] = [];

  for (let t = start; t < end; t += bucketMinutes) {
    const within = activeReservations(reservations).filter((r) => {
      const m = toMinutes(r.time);
      return m >= t && m < t + bucketMinutes;
    });
    buckets.push({
      label: `${fmt(t)}–${fmt(t + bucketMinutes - 1)}`,
      covers: within.reduce((sum, r) => sum + r.partySize, 0),
      reservations: within.length,
    });
  }
  return buckets;
}

export function peakWindow(buckets: PacingBucket[]): string | undefined {
  let best: PacingBucket | undefined;
  for (const b of buckets) {
    if (!best || b.covers > best.covers) best = b;
  }
  return best && best.covers > 0 ? best.label : undefined;
}

export function headlineStats(
  reservations: Reservation[],
  guestsById: Map<string, Guest>,
  buckets: PacingBucket[],
  visitCeiling: number,
): HeadlineStats {
  const active = activeReservations(reservations);
  const totalCovers = active.reduce((sum, r) => sum + r.partySize, 0);

  let regularCount = 0;
  let vipCount = 0;
  for (const r of active) {
    const g = r.guestId ? guestsById.get(r.guestId) : undefined;
    if (g?.isRegular) regularCount++;
    if (g?.vip) vipCount++;
  }

  return {
    totalCovers,
    totalReservations: active.length,
    peakWindow: peakWindow(buckets),
    largestParty: active.reduce((max, r) => Math.max(max, r.partySize), 0),
    firstTimerCount: firstTimers(reservations, guestsById, visitCeiling).length,
    regularCount,
    vipCount,
  };
}

/** Short, human note on how weather might bend the night. */
export function weatherImpact(precipChance: number, condition: string): string | null {
  const c = condition.toLowerCase();
  if (precipChance >= 50 || c.includes("rain") || c.includes("storm") || c.includes("snow")) {
    return "Wet weather — expect later arrivals, patio likely dead, and a few no-shows. Hold tables a touch longer.";
  }
  if (c.includes("clear") || c.includes("sunny")) {
    return "Clear skies — patio will move; staff it and pre-bus it.";
  }
  return null;
}
