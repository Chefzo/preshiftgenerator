import type { DataProvider } from "../provider";
import type {
  EightySixItem,
  Guest,
  Reservation,
  ReservationChannel,
  TicketStat,
} from "@/lib/types";
import { ToastClient } from "./toastClient";

/**
 * Live Toast integration, mapped onto the same DataProvider interface as the
 * seed provider. Each method maps a Toast payload into the normalized model.
 *
 * The endpoint paths below follow Toast's published API families (Tables /
 * Menus / Orders) but MUST be verified against current partner docs and the
 * sandbox before going live. The mapping logic is what matters here: once a
 * method returns normalized types, the rest of the app is unchanged.
 */
export class ToastProvider implements DataProvider {
  readonly name = "toast";
  private readonly client: ToastClient;

  constructor() {
    if (!ToastClient.credentialsPresent()) {
      throw new Error(
        "DATA_PROVIDER=toast but Toast credentials are missing. Set " +
          "TOAST_API_HOSTNAME, TOAST_CLIENT_ID, TOAST_CLIENT_SECRET, " +
          "TOAST_RESTAURANT_GUID — or use DATA_PROVIDER=seed.",
      );
    }
    this.client = new ToastClient();
  }

  async getReservations(date: string): Promise<Reservation[]> {
    // Toast Tables — bookings for the service date.
    const raw = await this.client.get<ToastBooking[]>("/bookings/v1/bookings", {
      startDate: date,
      endDate: date,
    });
    return raw.map(mapBooking);
  }

  async getGuests(ids: string[]): Promise<Guest[]> {
    // Toast guest CRM — fetch each referenced guest. Toast keys guests by GUID.
    const guests = await Promise.all(
      ids.map((id) =>
        this.client
          .get<ToastGuest>(`/guest/v1/guests/${id}`)
          .then(mapGuest)
          .catch(() => null),
      ),
    );
    return guests.filter((g): g is Guest => g !== null);
  }

  async getEightySixList(_date: string): Promise<EightySixItem[]> {
    // Menu item availability — items flagged out-of-stock are tonight's 86 list.
    const menus = await this.client.get<ToastMenusResponse>("/menus/v2/menus");
    return extractEightySix(menus);
  }

  async getTicketStats(date: string): Promise<TicketStat[]> {
    // Orders for the date; ticket time ≈ opened→closed per order, per guest.
    const orders = await this.client.get<ToastOrder[]>("/orders/v2/ordersBulk", {
      startDate: date,
      endDate: date,
    });
    return orders
      .map(mapOrderToTicket)
      .filter((t): t is TicketStat => t !== null);
  }
}

// ---------------------------------------------------------------------------
// Raw Toast payload shapes (partial; verify against sandbox) + mappers
// ---------------------------------------------------------------------------

interface ToastBooking {
  guid: string;
  expectedStartTime: string; // ISO datetime
  partySize: number;
  guestGuid?: string;
  source?: string;
  status?: string;
  notes?: string;
}

interface ToastGuest {
  guid: string;
  firstName?: string;
  lastName?: string;
  visitCount?: number;
  lastVisitDate?: string;
  totalSpend?: number;
  tags?: string[];
}

interface ToastMenusResponse {
  menus: { menuGroups: { menuItems: ToastMenuItem[] }[] }[];
}

interface ToastMenuItem {
  guid: string;
  name: string;
  // Toast surfaces availability/out-of-stock state on the item.
  inStock?: boolean;
  unitOfMeasure?: string;
}

interface ToastOrder {
  guid: string;
  openedDate?: string;
  closedDate?: string;
  checks?: { customer?: { guid?: string } }[];
}

function mapChannel(source?: string): ReservationChannel {
  switch ((source ?? "").toUpperCase()) {
    case "GOOGLE":
      return "google";
    case "TOAST":
    case "TOAST_TABLES":
      return "toast";
    case "PHONE":
      return "phone";
    case "WALK_IN":
      return "walkin";
    default:
      return "direct";
  }
}

function mapBooking(b: ToastBooking): Reservation {
  const time = b.expectedStartTime?.slice(11, 16) || "00:00";
  return {
    id: b.guid,
    time,
    partySize: b.partySize,
    guestId: b.guestGuid,
    channel: mapChannel(b.source),
    status: (b.status?.toLowerCase() as Reservation["status"]) || "booked",
    tags: [],
    notes: b.notes,
  };
}

function mapGuest(g: ToastGuest): Guest {
  const visitCount = g.visitCount ?? 0;
  return {
    id: g.guid,
    name: [g.firstName, g.lastName].filter(Boolean).join(" ") || "Guest",
    isRegular: visitCount >= 3,
    visitCount,
    lastVisitDate: g.lastVisitDate?.slice(0, 10),
    lifetimeSpend: g.totalSpend,
    vip: (g.tags ?? []).some((t) => t.toLowerCase() === "vip"),
    allergies: [],
    preferences: [],
    source: "toast_crm",
  };
}

function extractEightySix(menus: ToastMenusResponse): EightySixItem[] {
  const items: EightySixItem[] = [];
  for (const menu of menus.menus ?? []) {
    for (const group of menu.menuGroups ?? []) {
      for (const item of group.menuItems ?? []) {
        if (item.inStock === false) {
          items.push({
            itemId: item.guid,
            name: item.name,
            available: false,
            reason: "Marked out of stock in Toast",
          });
        }
      }
    }
  }
  return items;
}

function mapOrderToTicket(order: ToastOrder): TicketStat | null {
  if (!order.openedDate || !order.closedDate) return null;
  const opened = Date.parse(order.openedDate);
  const closed = Date.parse(order.closedDate);
  if (!Number.isFinite(opened) || !Number.isFinite(closed) || closed <= opened) {
    return null;
  }
  return {
    guestId: order.checks?.[0]?.customer?.guid,
    avgMinutes: Math.round((closed - opened) / 60000),
    sampleDate: order.openedDate.slice(0, 10),
  };
}
