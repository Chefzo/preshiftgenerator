import { describe, it, expect } from "vitest";
import { parseBriefJson } from "./generateBrief";

describe("parseBriefJson", () => {
  const valid = JSON.stringify({
    narrative: "Tonight we're at 36 covers...",
    hitList: ["Push short rib", "Watch the 8-top"],
    whiteGlove: ["Robert Anders — last ticket ran long"],
    eightySix: ["Branzino is 86'd"],
    upsellLine: "Start them with the Negroni flight.",
  });

  it("parses clean JSON", () => {
    const b = parseBriefJson(valid);
    expect(b.narrative).toMatch(/36 covers/);
    expect(b.hitList).toHaveLength(2);
  });

  it("strips a markdown code fence", () => {
    const b = parseBriefJson("```json\n" + valid + "\n```");
    expect(b.upsellLine).toMatch(/Negroni/);
  });

  it("extracts JSON embedded in prose", () => {
    const b = parseBriefJson("Here's your brief:\n" + valid + "\nHope that helps!");
    expect(b.narrative).toMatch(/covers/);
  });

  it("defaults missing arrays to empty", () => {
    const b = parseBriefJson(JSON.stringify({ narrative: "x", upsellLine: "y" }));
    expect(b.hitList).toEqual([]);
    expect(b.whiteGlove).toEqual([]);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseBriefJson("not json at all")).toThrow();
  });

  it("throws when required string fields are missing", () => {
    expect(() => parseBriefJson(JSON.stringify({ hitList: [] }))).toThrow();
  });
});
