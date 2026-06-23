import { NextRequest, NextResponse } from "next/server";
import { buildDashboardBrief, todayIso } from "@/lib/brief/pipeline";
import { renderBriefEmail } from "@/lib/brief/renderEmail";
import { sendBriefEmail } from "@/lib/email";
import { isValidIsoDate } from "@/lib/dates";
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
  // Fail closed: without a configured secret this endpoint would otherwise be a
  // public trigger that sends email and bills Claude. Refuse rather than run.
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; refusing to run." },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get("date") || todayIso();
  if (!isValidIsoDate(date)) {
    return NextResponse.json({ error: "Invalid date; expected YYYY-MM-DD." }, { status: 400 });
  }
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
