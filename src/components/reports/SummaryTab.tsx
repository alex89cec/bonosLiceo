"use client";

import { useState } from "react";
import type { SummaryReport } from "@/types/reports";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import ProgressBar from "./ProgressBar";

export default function SummaryTab({ data }: { data: SummaryReport }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card text-center">
          <p className="text-xs text-navy-400">Esperado</p>
          <p className="text-lg font-bold text-navy-700">
            {formatCurrency(data.total_expected)}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-navy-400">Cobrado</p>
          <p className="text-lg font-bold text-green-600">
            {formatCurrency(data.total_confirmed)}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-navy-400">Pendiente</p>
          <p className="text-lg font-bold text-amber-600">
            {formatCurrency(data.total_pending)}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-navy-400">Vendidos</p>
          <p className="text-lg font-bold text-blue-600">
            {formatNumber(data.total_sold + data.total_reserved)}{" "}
            <span className="text-sm font-normal text-navy-400">
              / {formatNumber(data.total_numbers)}
            </span>
          </p>
        </div>
      </div>

      {/* Overdue alert */}
      {data.overdue_count > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-700">
                {data.overdue_count} cuotas vencidas
              </p>
              <p className="text-xs text-red-600">
                Total adeudado: {formatCurrency(data.overdue_amount)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Campaign progress */}
      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-navy-400">
          Progreso por Campaña
        </h3>
        <div className="space-y-3">
          {data.campaigns.map((c) => {
            const isExpanded = expanded === c.id;
            const hasSales = c.reservations && c.reservations.length > 0;

            return (
              <div key={c.id} className="card overflow-hidden">
                {/* Campaign header — clickable */}
                <button
                  onClick={() => hasSales && setExpanded(isExpanded ? null : c.id)}
                  className={`w-full text-left ${hasSales ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-navy-700">{c.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.status === "active"
                            ? "bg-green-100 text-green-700"
                            : c.status === "sorted"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {c.status === "active" ? "Activa" : c.status === "sorted" ? "Sorteada" : "Cerrada"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-navy-600">
                        {formatPercent(c.percent)}
                      </p>
                      {hasSales && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-4 w-4 text-navy-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <ProgressBar
                    total={c.total}
                    segments={[
                      { value: c.sold, color: "bg-green-500", label: "Vendidos" },
                      { value: c.reserved, color: "bg-amber-400", label: "Reservados" },
                    ]}
                  />
                  <div className="mt-1.5 flex justify-between text-xs text-navy-400">
                    <span>{formatNumber(c.sold)} vendidos + {formatNumber(c.reserved)} reservados</span>
                    <span>{formatNumber(c.total)} total</span>
                  </div>
                </button>

                {/* Expanded detail table */}
                {isExpanded && hasSales && (
                  <div className="mt-3 border-t border-navy-100 pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy-400">
                      Detalle de ventas ({c.reservations.length})
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-navy-100 text-xs text-navy-400">
                            <th className="pb-2 pr-3 font-medium">N&deg;</th>
                            <th className="pb-2 pr-3 font-medium">Comprador</th>
                            <th className="pb-2 pr-3 font-medium">Vendedor</th>
                            <th className="pb-2 pr-3 text-center font-medium">Estado</th>
                            <th className="pb-2 text-center font-medium">Pago</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.reservations.map((r) => (
                            <tr key={r.ticket_number} className="border-b border-navy-50">
                              <td className="py-2 pr-3">
                                <span className="rounded bg-navy-50 px-1.5 py-0.5 font-mono text-xs font-bold text-navy-700">
                                  #{r.ticket_number}
                                </span>
                              </td>
                              <td className="py-2 pr-3">
                                <p className="text-xs font-medium text-navy-700 truncate max-w-[160px]">
                                  {r.buyer_name || r.buyer_email}
                                </p>
                                {r.buyer_name && (
                                  <p className="text-[10px] text-navy-400 truncate max-w-[160px]">{r.buyer_email}</p>
                                )}
                              </td>
                              <td className="py-2 pr-3">
                                <p className="text-xs font-medium text-navy-700">{r.seller_name}</p>
                                {r.seller_code && (
                                  <p className="font-mono text-[10px] text-navy-400">{r.seller_code}</p>
                                )}
                              </td>
                              <td className="py-2 pr-3 text-center">
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    r.status === "confirmed"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {r.status === "confirmed" ? "Vendido" : "Reservado"}
                                </span>
                              </td>
                              <td className="py-2 text-center">
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    r.payment_status === "completed"
                                      ? "bg-green-100 text-green-700"
                                      : r.payment_status === "partial"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-yellow-100 text-yellow-700"
                                  }`}
                                >
                                  {r.payment_status === "completed"
                                    ? "Pagado"
                                    : r.payment_status === "partial"
                                      ? "Parcial"
                                      : "Pendiente"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
