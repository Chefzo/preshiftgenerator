import type Anthropic from "@anthropic-ai/sdk";
import type { BriefContext, GeneratedBrief } from "@/lib/types";
import { getAnthropic, getModel } from "@/lib/anthropic";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

/**
 * Call Claude to turn the assembled context into a structured brief.
 * The headlineStats are carried over from our own derivation (not the model's)
 * so the numbers on screen are always exact.
 */
export async function generateBrief(context: BriefContext): Promise<{
  brief: GeneratedBrief;
  model: string;
}> {
  const model = getModel();
  const client = getAnthropic();

  const message = await client.messages.create({
    model,
    max_tokens: 1500,
    temperature: 0.4,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(context) }],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const parsed = parseBriefJson(text);

  return {
    model,
    brief: {
      narrative: parsed.narrative,
      hitList: parsed.hitList,
      whiteGlove: parsed.whiteGlove,
      eightySix: parsed.eightySix,
      upsellLine: parsed.upsellLine,
      headlineStats: context.headline,
    },
  };
}

interface RawBrief {
  narrative: string;
  hitList: string[];
  whiteGlove: string[];
  eightySix: string[];
  upsellLine: string;
}

/**
 * Parse the model's JSON, tolerating an accidental markdown fence, and validate
 * the shape so a malformed response fails loudly rather than rendering garbage.
 */
export function parseBriefJson(text: string): RawBrief {
  let body = text.trim();
  if (body.startsWith("```")) {
    body = body.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  // If there's leading prose, grab the outermost JSON object.
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  if (first > 0 || last < body.length - 1) {
    if (first !== -1 && last !== -1) body = body.slice(first, last + 1);
  }

  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error("Claude did not return valid JSON for the brief.");
  }

  const d = data as Record<string, unknown>;
  if (typeof d.narrative !== "string" || typeof d.upsellLine !== "string") {
    throw new Error("Brief JSON missing required string fields.");
  }

  return {
    narrative: d.narrative,
    hitList: asStringArray(d.hitList),
    whiteGlove: asStringArray(d.whiteGlove),
    eightySix: asStringArray(d.eightySix),
    upsellLine: d.upsellLine,
  };
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
