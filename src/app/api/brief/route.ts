import { NextRequest, NextResponse } from "next/server";
import { buildDashboardBrief, todayIso } from "@/lib/brief/pipeline";

export const dynamic = "force-dynamic";

/** GET /api/brief?date=YYYY-MM-DD — assembled context + AI brief (cached per date). */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || todayIso();
  const data = await buildDashboardBrief(date);
  return NextResponse.json({ date, ...data });
}
