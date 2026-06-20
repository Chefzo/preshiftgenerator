import type { BriefContext, Guest, Reservation } from "@/lib/types";
import { briefConfig } from "../../../config/brief.config";
import { getProvider } from "@/lib/providers/provider";
import { getWeather } from "@/lib/providers/weather";
import {
  activeReservations,
  firstTimers,
  headlineStats,
  pacing,
  toMinutes,
  whiteGloveFlags,
} from "./signals";

/**
 * Pull from every provider in parallel and derive the full BriefContext —
 * the single structured payload handed to Claude and rendered by the UI.
 */
export async function assembleContext(date: string): Promise<BriefContext> {
  const provider = await getProvider();

  // Reservations + weather + 86 list are independent — fetch concurrently.
  const [reservations, weather, eightySix, ticketStats] = await Promise.all([
    provider.getReservations(date),
    getWeather(),
    provider.getEightySixList(date),
    provider.getTicketStats(date),
  ]);

  const guestIds = [...new Set(reservations.map((r) => r.guestId).filter((id): id is string => !!id))];
  const guests = await provider.getGuests(guestIds);
  const guestsById = new Map<string, Guest>(guests.map((g) => [g.id, g]));

  const ticketByGuest = new Map<string, number>();
  for (const t of ticketStats) {
    if (t.guestId) ticketByGuest.set(t.guestId, t.avgMinutes);
  }

  const buckets = pacing(
    reservations,
    briefConfig.serviceStart,
    briefConfig.serviceEnd,
    briefConfig.pacingBucketMinutes,
  );

  const active = activeReservations(reservations);

  return {
    restaurantName: briefConfig.restaurantName,
    date,
    serviceLabel: briefConfig.serviceLabel,
    headline: headlineStats(reservations, guestsById, buckets, briefConfig.firstTimerVisitCeiling),
    pacing: buckets.filter((b) => b.reservations > 0),
    firstTimers: firstTimers(reservations, guestsById, briefConfig.firstTimerVisitCeiling),
    whiteGlove: whiteGloveFlags(
      reservations,
      guestsById,
      ticketByGuest,
      briefConfig.whiteGloveTicketThresholdMinutes,
    ),
    vips: vipList(active, guestsById),
    allergies: allergyList(active, guestsById),
    largeParties: largeParties(active, guestsById),
    eightySix,
    weather,
    upsell: briefConfig.upsell,
  };
}

function vipList(reservations: Reservation[], guestsById: Map<string, Guest>) {
  return reservations
    .map((r) => (r.guestId ? guestsById.get(r.guestId) : undefined))
    .filter((g): g is Guest => !!g && g.vip)
    .map((g) => ({
      guestName: g.name,
      notes: [g.preferences.join("; "), g.lifetimeSpend ? `$${g.lifetimeSpend.toLocaleString()} lifetime` : ""]
        .filter(Boolean)
        .join(" · "),
    }));
}

function allergyList(reservations: Reservation[], guestsById: Map<string, Guest>) {
  const out: { guestName: string; allergies: string[]; time: string }[] = [];
  for (const r of reservations) {
    const g = r.guestId ? guestsById.get(r.guestId) : undefined;
    if (g && g.allergies.length > 0) {
      out.push({ guestName: g.name, allergies: g.allergies, time: r.time });
    }
  }
  return out.sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
}

function largeParties(reservations: Reservation[], guestsById: Map<string, Guest>) {
  const THRESHOLD = 6;
  return reservations
    .filter((r) => r.partySize >= THRESHOLD)
    .map((r) => ({
      time: r.time,
      partySize: r.partySize,
      guestName: r.guestId ? guestsById.get(r.guestId)?.name : undefined,
      tags: r.tags,
    }))
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
}
