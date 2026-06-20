import { buildDashboardBrief, todayIso } from "@/lib/brief/pipeline";
import { BriefView } from "./components/BriefView";

// Always render fresh — the brief reflects tonight's live book.
export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date || todayIso();
  const data = await buildDashboardBrief(date);

  return <BriefView data={data} date={date} />;
}
