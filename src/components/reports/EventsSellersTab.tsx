"use client";

import { useMemo, useState } from "react";
import type { EventsSellerReport } from "@/types/reports";
import { formatCurrency } from "@/lib/format";

export default function EventsSellersTab({
  data,
}: {
  data: EventsSellerReport[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase().trim();
    return data.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)),
    );
  }, [data, search]);

  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-navy-400">
        No hay ventas de eventos por vendedor.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          className="input-field pl-10"
          placeholder="Buscar vendedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <p className="text-xs text-navy-400">
        Mostrando {filtered.length} de {data.length}
      </p>

      {filtered.map((s) => {
        const isOpen = expanded === s.id;
        return (
          <div key={s.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-navy-700">{s.name}</p>
                <p className="text-xs text-navy-400">
                  {s.code && <span className="mr-2 font-mono">{s.code}</span>}
                  {s.email}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-green-50 p-2">
                <p className="text-base font-bold text-green-600">
                  {s.approved_orders}
                </p>
                <p className="text-[10px] text-green-700/80">Aprobadas</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2">
                <p className="text-base font-bold text-amber-600">
                  {s.pending_orders}
                </p>
                <p className="text-[10px] text-amber-700/80">Pendientes</p>
              </div>
              <div className="rounded-lg bg-navy-50 p-2">
                <p className="text-sm font-bold text-navy-700">
                  {formatCurrency(s.total_amount_collected)}
                </p>
                <p className="text-[10px] text-navy-500">Cobrado</p>
              </div>
            </div>

            {s.events.length > 0 && (
              <>
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-medium text-navy-400 hover:text-navy-600"
                >
                  {isOpen
                    ? "Ocultar eventos"
                    : `Ver ${s.events.length} eventos`}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {isOpen && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-navy-100 text-xs text-navy-400">
                          <th className="pb-2 pr-3 font-medium">Evento</th>
                          <th className="pb-2 pr-3 text-right font-medium">
                            Aprob.
                          </th>
                          <th className="pb-2 pr-3 text-right font-medium">
                            Pend.
                          </th>
                          <th className="pb-2 text-right font-medium">
                            Cobrado
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.events.map((ev) => (
                          <tr
                            key={ev.event_id}
                            className="border-b border-navy-50"
                          >
                            <td className="py-2 pr-3 text-xs font-medium text-navy-700">
                              {ev.event_name}
                            </td>
                            <td className="py-2 pr-3 text-right text-xs text-green-600">
                              {ev.approved_orders}
                            </td>
                            <td className="py-2 pr-3 text-right text-xs text-amber-600">
                              {ev.pending_orders}
                            </td>
                            <td className="py-2 text-right text-xs font-semibold text-navy-700">
                              {formatCurrency(ev.amount_collected)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
