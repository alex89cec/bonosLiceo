"use client";

import { useEffect, useRef, useState } from "react";
import type { EventLiveRow } from "@/types/reports";

const AUTO_REFRESH_MS = 30_000;

interface Props {
  data: EventLiveRow[];
  /** Last time the parent refetched, in ms. Used to show "hace 5s". */
  lastFetchedAt: number;
  /** Tells the parent to refetch the live data. */
  onRefresh: () => void;
  refreshing: boolean;
}

export default function EventsLiveTab({
  data,
  lastFetchedAt,
  onRefresh,
  refreshing,
}: Props) {
  // Re-render every 10s so the "hace X" labels stay fresh without re-fetching.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  // Auto-refresh every 30s. Refs avoid re-creating the interval on every
  // re-render or when the callback identity changes.
  const onRefreshRef = useRef(onRefresh);
  const refreshingRef = useRef(refreshing);
  onRefreshRef.current = onRefresh;
  refreshingRef.current = refreshing;
  useEffect(() => {
    const id = setInterval(() => {
      if (!refreshingRef.current) onRefreshRef.current();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-navy-100 bg-white p-12 text-center shadow-sm">
        <p className="text-3xl">🎟️</p>
        <p className="mt-3 text-sm text-navy-400">
          No hay eventos activos en este momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Refresh bar */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-navy-100 bg-white px-4 py-2 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-navy-500">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span className="font-semibold uppercase tracking-wider text-red-600">
            En vivo
          </span>
          <span className="text-navy-300">·</span>
          <span>actualizado {humanAgo(lastFetchedAt)}</span>
          <span className="text-navy-300">·</span>
          <span className="text-navy-400">auto cada 30s</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-navy-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-navy-800 disabled:opacity-60"
        >
          {refreshing ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          )}
          Actualizar
        </button>
      </div>

      {data.map((e) => (
        <EventCard key={e.id} ev={e} />
      ))}
    </div>
  );
}

function EventCard({ ev }: { ev: EventLiveRow }) {
  const pct = ev.total_people > 0 ? (ev.scanned / ev.total_people) * 100 : 0;
  const dateStr = new Date(ev.event_date).toLocaleString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-navy-100 bg-navy-700 px-5 py-4 text-white">
        <h3 className="text-lg font-bold">{ev.name}</h3>
        <p className="mt-0.5 text-xs text-navy-200">
          📅 {dateStr}
          {ev.venue && <span> · 📍 {ev.venue}</span>}
        </p>
      </div>

      {/* Big stats */}
      <div className="grid grid-cols-3 gap-px bg-navy-100">
        <Stat label="Vendidas" value={ev.total_people} color="text-navy-700" />
        <Stat label="Escaneadas" value={ev.scanned} color="text-green-600" />
        <Stat label="Faltan" value={ev.remaining} color="text-amber-600" />
      </div>

      {/* Progress bar */}
      <div className="border-t border-navy-100 px-5 pt-4">
        <div className="flex items-end justify-between text-xs">
          <span className="font-semibold text-navy-500">Asistencia</span>
          <span className="font-bold text-navy-700">{pct.toFixed(0)}%</span>
        </div>
        <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-navy-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Per-type breakdown */}
      {ev.types.length > 0 && (
        <div className="space-y-2 px-5 pb-4 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">
            Desglose por tipo
          </p>
          {ev.types.map((t) => {
            const tpct = t.total > 0 ? (t.scanned / t.total) * 100 : 0;
            return (
              <div key={t.id}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-navy-700">{t.name}</span>
                  <span className="font-mono text-navy-500">
                    <span className="font-bold text-green-600">{t.scanned}</span>
                    /{t.total}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-100">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${tpct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cortesías */}
      {(ev.complimentary_total ?? 0) > 0 && (
        <div className="space-y-1 border-t border-navy-50 bg-purple-50/40 px-5 pb-3 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-700">
              🎁 Cortesías (aparte de las vendidas)
            </p>
            <span className="font-mono text-xs text-navy-500">
              <span className="font-bold text-green-600">
                {ev.complimentary_scanned}
              </span>
              /{ev.complimentary_total}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-purple-100">
            <div
              className="h-full rounded-full bg-purple-500 transition-all"
              style={{
                width: `${
                  ev.complimentary_total > 0
                    ? (ev.complimentary_scanned / ev.complimentary_total) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Bundles / packs */}
      {(ev.bundles?.length ?? 0) > 0 && (
        <div className="space-y-2 border-t border-navy-50 bg-purple-50/40 px-5 pb-4 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-700">
            Packs (incluidos en los números de arriba)
          </p>
          {ev.bundles.map((b) => {
            const bpct =
              b.packs_sold > 0 ? (b.packs_scanned / b.packs_sold) * 100 : 0;
            return (
              <div key={b.id}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-navy-700">
                    📦 {b.name}
                    <span className="ml-1 text-purple-600">
                      ({b.pack_size} pers./pack)
                    </span>
                  </span>
                  <span className="font-mono text-navy-500">
                    <span className="font-bold text-green-600">
                      {b.packs_scanned}
                    </span>
                    /{b.packs_sold} packs
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-purple-100">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all"
                    style={{ width: `${bpct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer: last scan */}
      <div className="border-t border-navy-50 bg-navy-50/50 px-5 py-2 text-center text-xs text-navy-500">
        {ev.last_scan_at ? (
          <>
            Última entrada escaneada {humanAgo(new Date(ev.last_scan_at).getTime())}
          </>
        ) : (
          "Todavía no hay personas escaneadas"
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white px-3 py-5 text-center">
      <p className={`text-4xl font-extrabold leading-none ${color}`}>{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-navy-400">
        {label}
      </p>
    </div>
  );
}

function humanAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return "hace un instante";
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return `hace ${h} h`;
}
