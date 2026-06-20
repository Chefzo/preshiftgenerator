import type { DataProvider } from "../provider";
import type {
  EightySixItem,
  Guest,
  Reservation,
  TicketStat,
} from "@/lib/types";

import reservations from "./data/reservations.json";
import guests from "./data/guests.json";
import eightysix from "./data/eightysix.json";
import tickets from "./data/tickets.json";

/**
 * Default provider. Serves a realistic, hand-built res book for whatever date is
 * requested (the data is time-of-day only, so "tonight" always has a full book).
 * Lets the entire pipeline — and CI — run with zero credentials.
 */
export class SeedProvider implements DataProvider {
  readonly name = "seed";

  async getReservations(_date: string): Promise<Reservation[]> {
    return reservations as Reservation[];
  }

  async getGuests(ids: string[]): Promise<Guest[]> {
    const all = guests as Guest[];
    if (ids.length === 0) return all;
    const wanted = new Set(ids);
    return all.filter((g) => wanted.has(g.id));
  }

  async getEightySixList(_date: string): Promise<EightySixItem[]> {
    return eightysix as EightySixItem[];
  }

  async getTicketStats(_date: string): Promise<TicketStat[]> {
    return tickets as TicketStat[];
  }
}
