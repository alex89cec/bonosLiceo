"use client";

import { useState } from "react";
import ReservationCard, {
  type ReservationCardData,
} from "@/components/ReservationCard";
import BuyerGroupCard from "@/components/BuyerGroupCard";
import EventOrderCard, {
  type EventOrderCardData,
} from "@/components/EventOrderCard";
import { formatCurrency } from "@/lib/format";

interface BonosCampaign {
  id: string;
  name: string;
  slug: string;
  status: string;
  ticket_price: number;
}

interface BonosStats {
  reserved: number;
  sold: number;
  total_amount: number;
}

interface AssignedEvent {
  id: string;
  name: string;
  slug: string;
  status: string;
  event_date: string;
  venue: string | null;
  can_sell: boolean;
  can_scan: boolean;
  approved_count: number;
  pending_count: number;
}

interface EventsStats {
  approved_orders: number;
  pending_orders: number;
  total_amount: number;
}

interface Props {
  bonosCampaigns: BonosCampaign[];
  bonosStats: BonosStats;
  bonosReservations: ReservationCardData[];
  events: AssignedEvent[];
  eventsStats: EventsStats;
  eventOrders: EventOrderCardData[];
}

type Tab = "bonos" | "eventos" | "ventas";

export default function DashboardTabs({
  bonosCampaigns,
  bonosStats,
  bonosReservations,
  events,
  eventsStats,
  eventOrders,
}: Props) {
  const [tab, setTab] = useState<Tab>("bonos");

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "bonos", label: "Bonos", count: bonosCampaigns.length },
    { key: "eventos", label: "Eventos", count: events.length },
    {
      key: "ventas",
      label: "Ventas recientes",
      count: bonosReservations.length + eventOrders.length,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-navy-700 text-white"
                : "border border-navy-200 text-navy-600 hover:bg-navy-50"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                className={`ml-1.5 text-xs ${tab === t.key ? "opacity-80" : "opacity-60"}`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "bonos" && (
        <BonosTab campaigns={bonosCampaigns} stats={bonosStats} />
      )}
      {tab === "eventos" && <EventosTab events={events} stats={eventsStats} />}
      {tab === "ventas" && (
        <VentasTab
          bonosReservations={bonosReservations}
          eventOrders={eventOrders}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────
// Bonos tab
// ───────────────────────────────────────────────
function BonosTab({
  campaigns,
  stats,
}: {
  campaigns: BonosCampaign[];
  stats: BonosStats;
}) {
  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center">
          <p className="text-xl font-bold text-yellow-600">{stats.reserved}</p>
          <p className="text-[10px] text-navy-400">Reservados</p>
        </div>
        <div className="card text-center">
          <p className="text-xl font-bold text-green-600">{stats.sold}</p>
          <p className="text-[10px] text-navy-400">Vendidos</p>
        </div>
        <div className="card text-center">
          <p className="text-sm font-bold text-green-600">
            {formatCurrency(stats.total_amount)}
          </p>
          <p className="text-[10px] text-navy-400">Cobrado</p>
        </div>
      </div>

      {/* Campaigns */}
      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
          Mis campañas
        </h2>
        <div className="space-y-2">
          {campaigns.map((c) => (
            <a
              key={c.id}
              href={c.status === "active" ? `/seller/sell/${c.slug}` : "#"}
              className={`card flex items-center justify-between transition-all ${
                c.status === "active"
                  ? "hover:border-gold-400 hover:bg-gold-50"
                  : "opacity-50"
              }`}
            >
              <div>
                <p className="font-semibold text-navy-700">{c.name}</p>
                <p className="text-sm text-navy-400">${c.ticket_price}</p>
              </div>
              {c.status === "active" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-3 py-1 text-xs font-semibold text-gold-800">
                  Vender
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {c.status}
                </span>
              )}
            </a>
          ))}

          {campaigns.length === 0 && (
            <p className="py-8 text-center text-sm text-navy-400">
              No tenés campañas asignadas
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// Eventos tab
// ───────────────────────────────────────────────
function EventosTab({
  events,
  stats,
}: {
  events: AssignedEvent[];
  stats: EventsStats;
}) {
  const canScanAny = events.some((e) => e.can_scan);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center">
          <p className="text-xl font-bold text-amber-600">
            {stats.pending_orders}
          </p>
          <p className="text-[10px] text-navy-400">Pendientes</p>
        </div>
        <div className="card text-center">
          <p className="text-xl font-bold text-green-600">
            {stats.approved_orders}
          </p>
          <p className="text-[10px] text-navy-400">Aprobadas</p>
        </div>
        <div className="card text-center">
          <p className="text-sm font-bold text-green-600">
            {formatCurrency(stats.total_amount)}
          </p>
          <p className="text-[10px] text-navy-400">Cobrado</p>
        </div>
      </div>

      {/* Scanner CTA — only for users with can_scan on at least one event */}
      {canScanAny && (
        <a
          href="/scanner"
          className="flex items-center justify-between gap-3 rounded-2xl border border-navy-700 bg-navy-700 px-4 py-3 text-white shadow-md transition-all hover:bg-navy-800"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500 text-navy-900">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold">Escanear entradas</p>
              <p className="text-[11px] text-navy-200">
                Validar QRs en la puerta
              </p>
            </div>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-navy-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </a>
      )}

      {/* Events */}
      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
          Mis eventos
        </h2>
        <div className="space-y-2">
          {events.map((event) => {
            const dateStr = new Date(event.event_date).toLocaleDateString(
              "es-AR",
              { day: "2-digit", month: "short", year: "numeric" },
            );
            return (
              <a
                key={event.id}
                href={
                  event.can_sell ? `/seller/events/${event.slug}/sell` : "#"
                }
                className="card block transition-all hover:border-gold-400 hover:bg-gold-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-navy-700">
                      {event.name}
                    </p>
                    <p className="text-xs text-navy-400">
                      📅 {dateStr}
                      {event.venue && <span> • {event.venue}</span>}
                    </p>
                    {(event.approved_count > 0 || event.pending_count > 0) && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                        {event.approved_count > 0 && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">
                            {event.approved_count} aprobadas
                          </span>
                        )}
                        {event.pending_count > 0 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                            {event.pending_count} pendientes
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {event.can_sell && (
                      <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-semibold text-gold-800">
                        Vender
                      </span>
                    )}
                    {event.can_scan && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                        Escanear
                      </span>
                    )}
                  </div>
                </div>
              </a>
            );
          })}

          {events.length === 0 && (
            <p className="py-8 text-center text-sm text-navy-400">
              No tenés eventos asignados
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// Ventas recientes tab
// ───────────────────────────────────────────────
function VentasTab({
  bonosReservations,
  eventOrders,
}: {
  bonosReservations: ReservationCardData[];
  eventOrders: EventOrderCardData[];
}) {
  // Build a unified feed:
  // - Bono reservations grouped by buyer_email
  // - Event orders as individual entries
  // Sorted by latest created_at DESC
  type FeedItem =
    | { kind: "bono_group"; key: string; items: ReservationCardData[]; sort_date: string }
    | { kind: "bono_single"; key: string; item: ReservationCardData; sort_date: string }
    | { kind: "event_order"; key: string; order: EventOrderCardData; sort_date: string };

  const grouped = new Map<string, ReservationCardData[]>();
  for (const r of bonosReservations) {
    const k = r.buyer_email || r.id;
    (grouped.get(k) ?? grouped.set(k, []).get(k)!).push(r);
  }

  const feed: FeedItem[] = [];
  for (const [email, group] of grouped) {
    const latest = group.reduce((max, r) =>
      r.created_at > max.created_at ? r : max,
    );
    if (group.length === 1) {
      feed.push({
        kind: "bono_single",
        key: group[0].id,
        item: group[0],
        sort_date: latest.created_at,
      });
    } else {
      feed.push({
        kind: "bono_group",
        key: email,
        items: group,
        sort_date: latest.created_at,
      });
    }
  }

  for (const o of eventOrders) {
    feed.push({
      kind: "event_order",
      key: `eo-${o.id}`,
      order: o,
      sort_date: o.created_at,
    });
  }

  feed.sort((a, b) => b.sort_date.localeCompare(a.sort_date));

  return (
    <div>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
        Ventas recientes (todas)
      </h2>
      <div className="space-y-2">
        {feed.length === 0 && (
          <p className="py-8 text-center text-sm text-navy-400">
            Sin ventas todavía
          </p>
        )}

        {feed.map((entry) => {
          if (entry.kind === "bono_single") {
            return <ReservationCard key={entry.key} reservation={entry.item} />;
          }
          if (entry.kind === "bono_group") {
            return (
              <BuyerGroupCard
                key={entry.key}
                buyerEmail={entry.key}
                reservations={entry.items}
              />
            );
          }
          return <EventOrderCard key={entry.key} order={entry.order} />;
        })}
      </div>
    </div>
  );
}
