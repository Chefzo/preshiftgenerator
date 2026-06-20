import type { UpsellPush } from "@/lib/types";

/**
 * Non-secret, committed configuration. Secrets live in env (.env.local).
 * The manager edits this file to set tonight's upsell push, the service window,
 * and the white-glove threshold.
 */
export interface BriefConfig {
  restaurantName: string;
  serviceLabel: string;
  /** Service window as 24h "HH:MM" used for pacing buckets and "tonight". */
  serviceStart: string;
  serviceEnd: string;
  /** Pacing bucket width in minutes. */
  pacingBucketMinutes: number;
  /**
   * A regular whose last visit ticket time exceeded this (minutes) gets flagged
   * for white-glove treatment tonight.
   */
  whiteGloveTicketThresholdMinutes: number;
  /** A guest is "new" / first-timer if they have at most this many prior visits. */
  firstTimerVisitCeiling: number;
  upsell: UpsellPush;
}

export const briefConfig: BriefConfig = {
  restaurantName: "The Copper Table",
  serviceLabel: "Dinner",
  serviceStart: "17:00",
  serviceEnd: "22:30",
  pacingBucketMinutes: 30,
  whiteGloveTicketThresholdMinutes: 20,
  firstTimerVisitCeiling: 0,
  upsell: {
    item: "Barrel-aged Negroni flight",
    talkingPoints: [
      "Three pours, lead with the 18-month barrel",
      "Pairs with the short rib and the duck",
      "Suggest it before they reach for the wine list",
    ],
    why: "High margin and we're long on the barrel stock this week",
  },
};
