import { describe, it, expect } from "vitest";
import { isValidIsoDate } from "./dates";

describe("isValidIsoDate", () => {
  it("accepts well-formed calendar dates", () => {
    expect(isValidIsoDate("2026-06-20")).toBe(true);
    expect(isValidIsoDate("2024-02-29")).toBe(true); // leap year
  });

  it("rejects wrong formats", () => {
    expect(isValidIsoDate("2026-6-20")).toBe(false);
    expect(isValidIsoDate("06/20/2026")).toBe(false);
    expect(isValidIsoDate("2026-06-20T00:00")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
    expect(isValidIsoDate("garbage")).toBe(false);
  });

  it("rejects impossible dates", () => {
    expect(isValidIsoDate("2026-02-31")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026-00-10")).toBe(false);
    expect(isValidIsoDate("2025-02-29")).toBe(false); // not a leap year
  });
});
