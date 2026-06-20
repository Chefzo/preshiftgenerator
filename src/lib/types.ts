/**
 * Normalized internal data model.
 *
 * Every provider (seed, Toast, weather) maps its raw payloads into these types,
 * and every downstream consumer — signal derivation, the Claude prompt, the
 * dashboard, the email — reads only from these types. That decoupling is what
 * lets the seed provider and the Toast provider be swapped with no other change.
 */

/** How a reservation reached us. `google` is the "first-timer off Google" signal. */
export type ReservationChannel = "google" | "toast" | "direct" | "walkin" | "phone";

export type ReservationStatus = "booked" | "confirmed" | "seated" | "cancelled" | "no_show";

export interface Reservation {
  id: string;
  /** Local clock time, 24h "HH:MM" (e.g. "19:30"). */
  time: string;
  partySize: number;
  /** Links to a Guest. May be absent for anonymous walk-ins. */
  guestId?: string;
  channel: ReservationChannel;
  status: ReservationStatus;
  /** Free-form tags from the booking platform: "birthday", "patio", "VIP", etc. */
  tags: string[];
  notes?: string;
}

/** Where we first learned about this guest. */
export type GuestSource = "google" | "toast_crm" | "direct" | "unknown";

export interface Guest {
  id: string;
  name: string;
  isRegular: boolean;
  visitCount: number;
  /** ISO date "YYYY-MM-DD" of last visit, if any. */
  lastVisitDate?: string;
  /** Ticket time (minutes) of the guest's last visit — the "22-min" white-glove signal. */
  lastVisitTicketMinutes?: number;
  lifetimeSpend?: number;
  vip: boolean;
  allergies: string[];
  preferences: string[];
  source: GuestSource;
}

export interface EightySixItem {
  itemId: string;
  name: string;
  /** false === 86'd / out of stock. */
  available: boolean;
  reason?: string;
}

/** Ticket-time statistics, either per-guest or shift-aggregate (guestId absent). */
export interface TicketStat {
  guestId?: string;
  avgMinutes: number;
  /** ISO date the sample is drawn from. */
  sampleDate: string;
}

export interface Weather {
  tempF: number;
  condition: string;
  /** 0..100. */
  precipChance: number;
  /** Local clock time "HH:MM". */
  sunsetLocal?: string;
  summary: string;
  alerts: string[];
}

/** Tonight's upsell push — configured by the manager, surfaced verbatim in the brief. */
export interface UpsellPush {
  item: string;
  talkingPoints: string[];
  /** Why we're pushing it: high margin, overstock, new menu item, etc. */
  why: string;
}

// ---------------------------------------------------------------------------
// Derived structures produced by the signal layer and consumed by Claude / UI
// ---------------------------------------------------------------------------

export interface PacingBucket {
  /** Window label, e.g. "19:00–19:29". */
  label: string;
  covers: number;
  reservations: number;
}

export interface WhiteGloveFlag {
  guestName: string;
  reason: string;
  lastVisitTicketMinutes?: number;
  notes?: string;
}

export interface FirstTimer {
  guestName?: string;
  partySize: number;
  time: string;
  channel: ReservationChannel;
}

export interface HeadlineStats {
  totalCovers: number;
  totalReservations: number;
  peakWindow?: string;
  largestParty: number;
  firstTimerCount: number;
  regularCount: number;
  vipCount: number;
}

/** Everything assembled for a single shift — the payload handed to Claude. */
export interface BriefContext {
  restaurantName: string;
  /** ISO date "YYYY-MM-DD". */
  date: string;
  serviceLabel: string;
  headline: HeadlineStats;
  pacing: PacingBucket[];
  firstTimers: FirstTimer[];
  whiteGlove: WhiteGloveFlag[];
  vips: { guestName: string; notes: string }[];
  allergies: { guestName: string; allergies: string[]; time: string }[];
  largeParties: { time: string; partySize: number; guestName?: string; tags: string[] }[];
  eightySix: EightySixItem[];
  weather: Weather;
  upsell: UpsellPush;
}

/** The structured brief Claude returns, validated before use. */
export interface GeneratedBrief {
  /** ~90-second spoken narrative, ~200–240 words. */
  narrative: string;
  /** Punchy bullet hit-list for quick reference. */
  hitList: string[];
  whiteGlove: string[];
  eightySix: string[];
  upsellLine: string;
  headlineStats: HeadlineStats;
}

/** Full result returned by the pipeline: derived context + generated brief. */
export interface BriefResult {
  context: BriefContext;
  brief: GeneratedBrief;
  generatedAt: string;
  model: string;
}
