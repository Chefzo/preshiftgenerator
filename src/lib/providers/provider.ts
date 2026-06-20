import type {
  EightySixItem,
  Guest,
  Reservation,
  TicketStat,
} from "@/lib/types";
import { env } from "@/lib/env";

/**
 * The single interface every reservation/POS source implements. Brief assembly
 * depends only on this — never on a concrete provider — so swapping seed ↔ Toast
 * changes nothing downstream.
 */
export interface DataProvider {
  readonly name: string;
  getReservations(date: string): Promise<Reservation[]>;
  getGuests(ids: string[]): Promise<Guest[]>;
  getEightySixList(date: string): Promise<EightySixItem[]>;
  getTicketStats(date: string): Promise<TicketStat[]>;
}

/**
 * Resolve the active provider from DATA_PROVIDER (default: seed).
 * Concrete providers are imported lazily so that, e.g., the Toast client and
 * its credential checks never load in a seed-only run.
 */
export async function getProvider(): Promise<DataProvider> {
  const choice = env("DATA_PROVIDER", "seed").toLowerCase();

  switch (choice) {
    case "toast": {
      const { ToastProvider } = await import("./toast/toastProvider");
      return new ToastProvider();
    }
    case "seed":
    default: {
      const { SeedProvider } = await import("./seed/seedProvider");
      return new SeedProvider();
    }
  }
}
