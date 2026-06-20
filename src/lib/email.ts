import { Resend } from "resend";
import { env, hasEnv } from "./env";

/** Send the brief email via Resend. No-ops with a clear message if unconfigured. */
export async function sendBriefEmail(args: {
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; detail: string }> {
  if (!hasEnv("RESEND_API_KEY", "EMAIL_FROM", "BRIEF_RECIPIENTS")) {
    return {
      sent: false,
      detail: "Email not configured (need RESEND_API_KEY, EMAIL_FROM, BRIEF_RECIPIENTS).",
    };
  }

  const recipients = env("BRIEF_RECIPIENTS")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const resend = new Resend(env("RESEND_API_KEY"));
  const { error } = await resend.emails.send({
    from: env("EMAIL_FROM"),
    to: recipients,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });

  if (error) return { sent: false, detail: error.message };
  return { sent: true, detail: `Sent to ${recipients.length} recipient(s).` };
}
