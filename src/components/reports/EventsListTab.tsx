"use client";

import { useState } from "react";
import type { EventReportRow } from "@/types/reports";
import { formatCurrency, formatNumber } from "@/lib/format";

export default function EventsListTab({ data }: { data: EventReportRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-navy-400">
        No hay eventos para mostrar.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((e) => {
        const isOpen = expanded === e.id;
        const dateStr = new Date(e.event_date).toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <div key={e.id} className="card overflow-hidden">
            {/* Header */}
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-navy-700">{e.name}</h3>
                  <StatusPill status={e.status} />
                </div>
                <p className="mt-1 text-xs text-navy-400">
                  📅 {dateStr}
                  {e.venue && <span> • 📍 {e.venue}</span>}
                </p>
              </div>
            </div>

            {/* Money + tickets stats */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-green-50 p-2 text-center">
                <p className="text-sm font-bold text-green-600">
                  {formatCurrency(e.total_amount_collected)}
                </p>
                <p className="text-[10px] text-green-700/80">Cobrado</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2 text-center">
                <p className="text-sm font-bold text-amber-600">
                  {formatCurrency(e.total_amount_pending)}
                </p>
                <p className="text-[10px] text-amber-700/80">Pendiente</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-2 text-center">
                <p className="text-lg font-bold text-blue-600">
                  {formatNumber(e.tickets_issued)}
                </p>
                <p className="text-[10px] text-blue-700/80">Entradas</p>
              </div>
              <div className="rounded-lg bg-navy-50 p-2 text-center">
                <p className="text-lg font-bold text-navy-700">
                  {e.total_orders}
                </p>
                <p className="text-[10px] text-navy-500">Órdenes</p>
              </div>
            </div>

            {/* Order breakdown */}
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {e.approved_orders > 0 && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">
                  ✓ {e.approved_orders} aprobadas
                </span>
              )}
              {e.pending_orders > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                  ⏳ {e.pending_orders} pendientes
                </span>
              )}
              {e.rejected_orders > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
                  ✕ {e.rejected_orders} rechazadas
                </span>
              )}
            </div>

            {/* Expand for ticket types */}
            {e.types.length > 0 && (
              <>
                <button
                  onClick={() => setExpanded(isOpen ? null : e.id)}
                  className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-medium text-navy-400 hover:text-navy-600"
                >
                  {isOpen
                    ? "Ocultar tipos de entrada"
                    : `Ver ${e.types.length} tipos de entrada`}
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
                          <th className="pb-2 pr-3 font-medium">Tipo</th>
                          <th className="pb-2 pr-3 text-right font-medium">
                            Vendidos
                          </th>
                          <th className="pb-2 pr-3 text-right font-medium">
                            Pendientes
                          </th>
                          <th className="pb-2 text-right font-medium">Cupo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {e.types.map((t) => (
                          <tr key={t.id} className="border-b border-navy-50">
                            <td className="py-2 pr-3 text-xs">
                              <span className="font-medium text-navy-700">
                                {t.is_bundle && "📦 "}
                                {t.name}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-right text-xs font-bold text-green-600">
                              {t.sold}
                            </td>
                            <td className="py-2 pr-3 text-right text-xs text-amber-600">
                              {t.pending}
                            </td>
                            <td className="py-2 text-right text-xs text-navy-500">
                              {t.quantity === null ? "Sin límite" : t.quantity}
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

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, { label: string; bg: string; text: string }> = {
    active: { label: "Activo", bg: "bg-green-100", text: "text-green-700" },
    past: { label: "Pasado", bg: "bg-gray-100", text: "text-gray-600" },
    cancelled: { label: "Cancelado", bg: "bg-red-100", text: "text-red-700" },
    draft: { label: "Borrador", bg: "bg-yellow-100", text: "text-yellow-700" },
  };
  const c = cfg[status] || {
    label: status,
    bg: "bg-gray-100",
    text: "text-gray-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
