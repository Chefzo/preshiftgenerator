import { NextRequest, NextResponse } from "next/server";
import { buildDashboardBrief, todayIso } from "@/lib/brief/pipeline";
import { isValidIsoDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** POST /api/brief/regenerate { date? } — force a fresh generation, bypassing cache. */
export async function POST(req: NextRequest) {
  let date = todayIso();
  try {
    const body = (await req.json()) as { date?: string };
    if (body.date) date = body.date;
  } catch {
    // empty/invalid body → regenerate today
  }

  if (!isValidIsoDate(date)) {
    return NextResponse.json({ error: "Invalid date; expected YYYY-MM-DD." }, { status: 400 });
  }

  const data = await buildDashboardBrief(date, true);
  return NextResponse.json({ date, ...data });
}
