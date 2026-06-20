import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

/** Default model — fast and economical for a once-a-day brief. */
export const DEFAULT_MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!env("ANTHROPIC_API_KEY")) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to generate the brief narrative.",
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  }
  return client;
}

export function getModel(): string {
  return env("ANTHROPIC_MODEL", DEFAULT_MODEL);
}
