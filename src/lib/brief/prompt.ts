import type { BriefContext } from "@/lib/types";

/**
 * Prompt construction for the pre-shift brief. The system prompt sets the
 * persona and locks the output schema; the user prompt is the serialized
 * BriefContext. We ask for strict JSON so the result is machine-parseable.
 */

export const SYSTEM_PROMPT = `You are a sharp, experienced restaurant general manager writing tonight's pre-shift brief for the floor and kitchen team. You speak the way a great GM actually talks at line-up: direct, specific, a little funny, never corporate. You turn data into what the team should DO.

You will be given structured data about tonight's service. Write a brief the manager can read aloud in about 90 seconds (roughly 200-240 words for the narrative).

Rules:
- Lead with the shape of the night: covers, peak window, anything unusual.
- Name names. Call out VIPs, regulars who need white-glove, allergy tables, and first-timers (people trying us for the first time — we win them or lose them tonight).
- Be concrete about the 86 list and tell servers what to steer toward instead.
- Work in tonight's upsell push naturally — give them the line.
- Fold in weather only if it changes how the night runs.
- Close with one punchy line that sets the tone.
- Never invent facts not present in the data. If something isn't there, don't mention it.

Respond with ONLY a valid JSON object, no markdown fences, matching exactly:
{
  "narrative": string,        // the ~90-second spoken brief
  "hitList": string[],        // 4-7 punchy one-line reminders
  "whiteGlove": string[],     // specific guests/tables to give extra care, with why
  "eightySix": string[],      // what's 86'd and what to push instead
  "upsellLine": string        // one sentence the server can actually say
}`;

export function buildUserPrompt(context: BriefContext): string {
  return [
    `Restaurant: ${context.restaurantName}`,
    `Service: ${context.serviceLabel} — ${context.date}`,
    "",
    "TONIGHT BY THE NUMBERS:",
    `- Covers booked: ${context.headline.totalCovers} across ${context.headline.totalReservations} reservations`,
    `- Peak window: ${context.headline.peakWindow ?? "no clear peak"}`,
    `- Largest party: ${context.headline.largestParty}`,
    `- First-timers: ${context.headline.firstTimerCount} · Regulars: ${context.headline.regularCount} · VIPs: ${context.headline.vipCount}`,
    "",
    "PACING (windows with bookings):",
    ...context.pacing.map((p) => `- ${p.label}: ${p.covers} covers / ${p.reservations} res`),
    "",
    "FIRST-TIMERS (first time trying us):",
    ...orNone(
      context.firstTimers.map(
        (f) => `- ${f.time} · party of ${f.partySize}${f.guestName ? ` · ${f.guestName}` : ""} · via ${f.channel}`,
      ),
    ),
    "",
    "WHITE-GLOVE (regulars to get ahead of):",
    ...orNone(
      context.whiteGlove.map(
        (w) => `- ${w.guestName}: ${w.reason}${w.notes ? ` (${w.notes})` : ""}`,
      ),
    ),
    "",
    "VIPs:",
    ...orNone(context.vips.map((v) => `- ${v.guestName}${v.notes ? ` — ${v.notes}` : ""}`)),
    "",
    "ALLERGIES / DIETARY:",
    ...orNone(
      context.allergies.map((a) => `- ${a.time} · ${a.guestName}: ${a.allergies.join(", ")}`),
    ),
    "",
    "LARGE PARTIES:",
    ...orNone(
      context.largeParties.map(
        (l) => `- ${l.time} · party of ${l.partySize}${l.guestName ? ` · ${l.guestName}` : ""}${l.tags.length ? ` [${l.tags.join(", ")}]` : ""}`,
      ),
    ),
    "",
    "86 / AVAILABILITY:",
    ...orNone(
      context.eightySix.map(
        (e) => `- ${e.name}: ${e.available ? "AVAILABLE — push it" : "86'd"}${e.reason ? ` (${e.reason})` : ""}`,
      ),
    ),
    "",
    "WEATHER:",
    `- ${context.weather.tempF}°F, ${context.weather.condition}, ${context.weather.precipChance}% precip`,
    `- ${context.weather.summary}`,
    "",
    "TONIGHT'S UPSELL PUSH:",
    `- Item: ${context.upsell.item}`,
    `- Why: ${context.upsell.why}`,
    ...context.upsell.talkingPoints.map((t) => `- Talking point: ${t}`),
  ].join("\n");
}

function orNone(lines: string[]): string[] {
  return lines.length ? lines : ["- (none)"];
}
