import type { BriefContext, GeneratedBrief } from "@/lib/types";

/**
 * Render the brief to a self-contained responsive HTML email. Plain string
 * templating (no JSX) keeps it portable and inline-styled for email clients.
 */
export function renderBriefEmail(
  context: BriefContext,
  brief: GeneratedBrief | null,
): { subject: string; html: string; text: string } {
  const h = context.headline;
  const dateLabel = formatDate(context.date);
  const subject = `Pre-shift · ${context.restaurantName} · ${dateLabel} · ${h.totalCovers} covers`;

  const section = (title: string, inner: string) =>
    inner
      ? `<tr><td style="padding:18px 24px 0"><div style="font:700 12px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8a93a0">${title}</div>${inner}</td></tr>`
      : "";

  const li = (s: string) =>
    `<div style="padding:6px 0;border-bottom:1px solid #eceff3;font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#1c2430">${s}</div>`;

  const narrative = brief
    ? `<div style="font:16px/1.7 -apple-system,Segoe UI,Roboto,sans-serif;color:#1c2430;white-space:pre-wrap">${escapeHtml(brief.narrative)}</div>`
    : `<div style="font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#8a93a0">AI narrative unavailable — data below.</div>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f9;padding:24px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6eaf0">
    <tr><td style="background:#0e1116;padding:22px 24px">
      <div style="font:700 12px/1.4 -apple-system,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#f5a623">Pre-Shift Brief</div>
      <div style="font:700 24px/1.3 -apple-system,sans-serif;color:#fff;margin-top:2px">${escapeHtml(context.restaurantName)}</div>
      <div style="font:14px/1.4 -apple-system,sans-serif;color:#93a0b0">${escapeHtml(context.serviceLabel)} · ${dateLabel}</div>
    </td></tr>
    <tr><td style="padding:18px 24px 0">
      <table role="presentation" width="100%"><tr>
        ${statCell(h.totalCovers, "Covers")}
        ${statCell(h.totalReservations, "Res")}
        ${statCell(h.firstTimerCount, "First-timers")}
        ${statCell(h.vipCount, "VIPs")}
      </tr></table>
    </td></tr>
    ${section("The brief", narrative)}
    ${section("Hit list", brief && brief.hitList.length ? brief.hitList.map(li).join("") : "")}
    ${section(
      "White-glove",
      context.whiteGlove.length
        ? context.whiteGlove.map((w) => li(`<strong>${escapeHtml(w.guestName)}</strong> — ${escapeHtml(w.reason)}`)).join("")
        : "",
    )}
    ${section(
      "First-timers",
      context.firstTimers.length
        ? context.firstTimers
            .map((f) => li(`${f.time} · ${escapeHtml(f.guestName ?? "Walk-in")} · party of ${f.partySize} (${f.channel})`))
            .join("")
        : "",
    )}
    ${section(
      "86 board",
      context.eightySix
        .map((e) => li(`${e.available ? "✅ PUSH" : "🚫 86"} <strong>${escapeHtml(e.name)}</strong>${e.reason ? ` — ${escapeHtml(e.reason)}` : ""}`))
        .join(""),
    )}
    ${section(
      "Weather",
      li(`${context.weather.tempF || "—"}° · ${escapeHtml(context.weather.condition)} · ${context.weather.precipChance}% precip`),
    )}
    ${section(
      "Tonight's upsell",
      li(`<strong>${escapeHtml(brief?.upsellLine ?? context.upsell.item)}</strong>`) +
        li(`<span style="color:#8a93a0">${escapeHtml(context.upsell.why)}</span>`),
    )}
    <tr><td style="padding:20px 24px;color:#9aa3b0;font:12px/1.5 -apple-system,sans-serif">
      Auto-generated from tonight's res book, the 86 list, guest history, and the weather. Runs off data you already have.
    </td></tr>
  </table></td></tr></table></body></html>`;

  return { subject, html, text: toText(context, brief) };
}

function statCell(num: number, label: string): string {
  return `<td style="padding:0 6px"><div style="background:#f4f6f9;border-radius:10px;padding:10px 12px">
    <div style="font:700 22px/1.1 -apple-system,sans-serif;color:#1c2430">${num}</div>
    <div style="font:11px/1.3 -apple-system,sans-serif;text-transform:uppercase;letter-spacing:.05em;color:#8a93a0">${label}</div>
  </div></td>`;
}

function toText(context: BriefContext, brief: GeneratedBrief | null): string {
  const lines = [
    `${context.restaurantName} — ${context.serviceLabel}, ${context.date}`,
    `${context.headline.totalCovers} covers / ${context.headline.totalReservations} res · ${context.headline.firstTimerCount} first-timers`,
    "",
    brief?.narrative ?? "(AI narrative unavailable)",
    "",
    "White-glove:",
    ...context.whiteGlove.map((w) => `- ${w.guestName}: ${w.reason}`),
    "",
    "86:",
    ...context.eightySix.map((e) => `- ${e.available ? "PUSH" : "86"} ${e.name}`),
  ];
  return lines.join("\n");
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
