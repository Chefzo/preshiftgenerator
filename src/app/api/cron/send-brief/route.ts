import { NextRequest, NextResponse } from "next/server";
import { buildDashboardBrief, todayIso } from "@/lib/brief/pipeline";
import { renderBriefEmail } from "@/lib/brief/renderEmail";
import { sendBriefEmail } from "@/lib/email";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
// Allow time for assembly + Claude generation.
export const maxDuration = 60;

/**
 * GET /api/cron/send-brief — generates tonight's brief and emails it.
 * Protected by CRON_SECRET (sent as `Authorization: Bearer <secret>`), which is
 * how Vercel Cron authenticates. Wire the schedule in vercel.json (4pm local).
 */
export async function GET(req: NextRequest) {
  const secret = env("CRON_SECRET");
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const date = req.nextUrl.searchParams.get("date") || todayIso();
  const data = await buildDashboardBrief(date, true);
  const email = renderBriefEmail(data.context, data.brief);
  const result = await sendBriefEmail(email);

  return NextResponse.json({
    date,
    generated: !!data.brief,
    narrativeError: data.narrativeError,
    email: result,
  });
}
