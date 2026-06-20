import { describe, it, expect } from "vitest";
import type { Guest, Reservation } from "@/lib/types";
import {
  firstTimers,
  headlineStats,
  isFirstTimer,
  pacing,
  peakWindow,
  weatherImpact,
  whiteGloveFlags,
} from "./signals";

function guest(partial: Partial<Guest> & { id: string; name: string }): Guest {
  return {
    isRegular: false,
    visitCount: 0,
    vip: false,
    allergies: [],
    preferences: [],
    source: "unknown",
    ...partial,
  };
}

function res(partial: Partial<Reservation> & { id: string; time: string }): Reservation {
  return {
    partySize: 2,
    channel: "direct",
    status: "confirmed",
    tags: [],
    ...partial,
  };
}

describe("isFirstTimer", () => {
  it("flags Google-channel bookings regardless of guest", () => {
    expect(isFirstTimer(res({ id: "a", time: "19:00", channel: "google" }), undefined, 0)).toBe(true);
  });

  it("flags a brand-new guest", () => {
    const g = guest({ id: "g1", name: "New", visitCount: 0 });
    expect(isFirstTimer(res({ id: "a", time: "19:00", guestId: "g1" }), g, 0)).toBe(true);
  });

  it("does not flag a regular", () => {
    const g = guest({ id: "g1", name: "Reg", isRegular: true, visitCount: 20 });
    expect(isFirstTimer(res({ id: "a", time: "19:00", guestId: "g1" }), g, 0)).toBe(false);
  });

  it("does not flag an anonymous walk-in", () => {
    expect(isFirstTimer(res({ id: "a", time: "19:00", channel: "walkin" }), undefined, 0)).toBe(false);
  });
});

describe("firstTimers", () => {
  it("collects and sorts first-timers by time", () => {
    const reservations = [
      res({ id: "a", time: "20:00", channel: "google" }),
      res({ id: "b", time: "18:00", channel: "google" }),
      res({ id: "c", time: "19:00", guestId: "reg" }),
    ];
    const guests = new Map([["reg", guest({ id: "reg", name: "Reg", isRegular: true, visitCount: 10 })]]);
    const result = firstTimers(reservations, guests, 0);
    expect(result.map((f) => f.time)).toEqual(["18:00", "20:00"]);
  });
});

describe("whiteGloveFlags", () => {
  it("flags a regular whose last ticket exceeded the threshold (the 22-min case)", () => {
    const reservations = [res({ id: "a", time: "19:00", guestId: "g1" })];
    const guests = new Map([
      ["g1", guest({ id: "g1", name: "Robert Anders", isRegular: true, visitCount: 23, lastVisitTicketMinutes: 22 })],
    ]);
    const flags = whiteGloveFlags(reservations, guests, new Map(), 20);
    expect(flags).toHaveLength(1);
    expect(flags[0].guestName).toBe("Robert Anders");
    expect(flags[0].lastVisitTicketMinutes).toBe(22);
  });

  it("does not flag a regular with a fast last ticket", () => {
    const reservations = [res({ id: "a", time: "19:00", guestId: "g1" })];
    const guests = new Map([
      ["g1", guest({ id: "g1", name: "Fast", isRegular: true, visitCount: 5, lastVisitTicketMinutes: 12 })],
    ]);
    expect(whiteGloveFlags(reservations, guests, new Map(), 20)).toHaveLength(0);
  });

  it("prefers fresh per-guest ticket stats over the stored last-visit value", () => {
    const reservations = [res({ id: "a", time: "19:00", guestId: "g1" })];
    const guests = new Map([
      ["g1", guest({ id: "g1", name: "Reg", isRegular: true, visitCount: 5, lastVisitTicketMinutes: 10 })],
    ]);
    const ticketByGuest = new Map([["g1", 25]]);
    expect(whiteGloveFlags(reservations, guests, ticketByGuest, 20)).toHaveLength(1);
  });

  it("ignores non-regulars even with a slow ticket", () => {
    const reservations = [res({ id: "a", time: "19:00", guestId: "g1" })];
    const guests = new Map([
      ["g1", guest({ id: "g1", name: "New", isRegular: false, lastVisitTicketMinutes: 40 })],
    ]);
    expect(whiteGloveFlags(reservations, guests, new Map(), 20)).toHaveLength(0);
  });
});

describe("pacing & peak", () => {
  const reservations = [
    res({ id: "a", time: "19:00", partySize: 6 }),
    res({ id: "b", time: "19:15", partySize: 4 }),
    res({ id: "c", time: "20:00", partySize: 2 }),
  ];

  it("buckets covers into windows", () => {
    const buckets = pacing(reservations, "19:00", "21:00", 30);
    expect(buckets[0].label).toBe("19:00–19:29");
    expect(buckets[0].covers).toBe(10);
    expect(buckets[0].reservations).toBe(2);
  });

  it("identifies the peak window", () => {
    const buckets = pacing(reservations, "19:00", "21:00", 30);
    expect(peakWindow(buckets)).toBe("19:00–19:29");
  });

  it("excludes cancelled reservations from pacing", () => {
    const withCancel = [...reservations, res({ id: "x", time: "19:00", partySize: 8, status: "cancelled" })];
    const buckets = pacing(withCancel, "19:00", "21:00", 30);
    expect(buckets[0].covers).toBe(10);
  });
});

describe("headlineStats", () => {
  it("aggregates covers, regulars, vips and first-timers", () => {
    const reservations = [
      res({ id: "a", time: "19:00", partySize: 6, guestId: "vip" }),
      res({ id: "b", time: "20:00", partySize: 2, channel: "google" }),
    ];
    const guests = new Map([["vip", guest({ id: "vip", name: "VIP", isRegular: true, vip: true, visitCount: 30 })]]);
    const buckets = pacing(reservations, "17:00", "22:00", 30);
    const h = headlineStats(reservations, guests, buckets, 0);
    expect(h.totalCovers).toBe(8);
    expect(h.totalReservations).toBe(2);
    expect(h.regularCount).toBe(1);
    expect(h.vipCount).toBe(1);
    expect(h.firstTimerCount).toBe(1);
    expect(h.largestParty).toBe(6);
  });
});

describe("weatherImpact", () => {
  it("warns on rain", () => {
    expect(weatherImpact(70, "Rain likely")).toMatch(/wet weather/i);
  });
  it("nudges patio on clear nights", () => {
    expect(weatherImpact(0, "Clear")).toMatch(/patio/i);
  });
  it("returns null for unremarkable weather", () => {
    expect(weatherImpact(10, "Partly cloudy")).toBeNull();
  });
});
