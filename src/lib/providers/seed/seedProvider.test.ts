import { describe, it, expect } from "vitest";
import { SeedProvider } from "./seedProvider";

describe("SeedProvider", () => {
  const p = new SeedProvider();

  it("returns a full res book for any date", async () => {
    const res = await p.getReservations("2026-06-20");
    expect(res.length).toBeGreaterThan(5);
    expect(res.every((r) => r.time && r.partySize > 0)).toBe(true);
  });

  it("returns only requested guests", async () => {
    const guests = await p.getGuests(["g-anders"]);
    expect(guests).toHaveLength(1);
    expect(guests[0].name).toBe("Robert Anders");
  });

  it("includes the 22-min white-glove regular", async () => {
    const [anders] = await p.getGuests(["g-anders"]);
    expect(anders.isRegular).toBe(true);
    expect(anders.lastVisitTicketMinutes).toBe(22);
  });

  it("has 86'd items in the list", async () => {
    const list = await p.getEightySixList("2026-06-20");
    expect(list.some((i) => !i.available)).toBe(true);
  });

  it("has Google first-timers in the book", async () => {
    const res = await p.getReservations("2026-06-20");
    expect(res.some((r) => r.channel === "google")).toBe(true);
  });
});
