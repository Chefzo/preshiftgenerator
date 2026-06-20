import type { BriefResult } from "@/lib/types";
import { assembleContext } from "./assembleContext";
import { generateBrief } from "./generateBrief";

/**
 * End-to-end: assemble context for a date, generate the brief, return both.
 * A small in-memory cache (per date) keeps the dashboard and the email cron
 * from re-billing Claude for the same shift; `force` bypasses it (Regenerate).
 */
const cache = new Map<string, BriefResult>();

export function todayIso(timeZone?: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || process.env.WEATHER_TIMEZONE || undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export async function buildBrief(date: string, force = false): Promise<BriefResult> {
  if (!force && cache.has(date)) return cache.get(date)!;

  const context = await assembleContext(date);
  const { brief, model } = await generateBrief(context);

  const result: BriefResult = {
    context,
    brief,
    generatedAt: new Date().toISOString(),
    model,
  };
  cache.set(date, result);
  return result;
}

export function clearBriefCache(): void {
  cache.clear();
}

export interface DashboardBrief {
  context: BriefResult["context"];
  brief: BriefResult["brief"] | null;
  generatedAt: string | null;
  model: string | null;
  /** Set when the data assembled but the AI narrative could not be generated. */
  narrativeError: string | null;
}

/**
 * Dashboard-friendly variant: always return the assembled context (so the data
 * cards render), and attach the AI narrative when it succeeds. A missing API key
 * or a model hiccup degrades to data-only rather than a blank page.
 */
export async function buildDashboardBrief(date: string, force = false): Promise<DashboardBrief> {
  try {
    const result = await buildBrief(date, force);
    return {
      context: result.context,
      brief: result.brief,
      generatedAt: result.generatedAt,
      model: result.model,
      narrativeError: null,
    };
  } catch (err) {
    // Generation failed — fall back to context-only so the floor still gets data.
    const { assembleContext } = await import("./assembleContext");
    const context = await assembleContext(date);
    return {
      context,
      brief: null,
      generatedAt: null,
      model: null,
      narrativeError: (err as Error).message,
    };
  }
}
