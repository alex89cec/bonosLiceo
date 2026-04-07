"use client";

import { useState } from "react";
import type { CampaignReport } from "@/types/reports";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import ProgressBar from "./ProgressBar";

export default function CampaignReportTab({ data }: { data: CampaignReport[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (data.length === 0) {
    return <p className="py-12 text-center text-gray-500">No hay campañas para mostrar.</p>;
  }

  return (
    <div className="space-y-4">
      {data.map((c) => (
        <div key={c.id} className="card">
          {/* Header */}
          <div className="mb-3 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-navy-700">{c.name}</h3>
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
              <p className="text-sm text-navy-400">
                Precio: {formatCurrency(c.ticket_price)}
              </p>
            </div>
            <p className="text-lg font-bold text-navy-700">{formatPercent(c.percent_sold)}</p>
          </div>

          {/* Progress bar */}
          <ProgressBar
            total={c.total_numbers}
            segments={[
              { value: c.sold, color: "bg-green-500", label: "Vendidos" },
              { value: c.reserved, color: "bg-amber-400", label: "Reservados" },
            ]}
          />

          {/* Ticket stats */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-gray-50 px-2 py-1.5">
              <p className="text-lg font-bold text-gray-500">{formatNumber(c.available)}</p>
              <p className="text-[10px] text-gray-400">Disponibles</p>
            </div>
            <div className="rounded-lg bg-amber-50 px-2 py-1.5">
              <p className="text-lg font-bold text-amber-600">{formatNumber(c.reserved)}</p>
              <p className="text-[10px] text-amber-500">Reservados</p>
            </div>
            <div className="rounded-lg bg-green-50 px-2 py-1.5">
              <p className="text-lg font-bold text-green-600">{formatNumber(c.sold)}</p>
              <p className="text-[10px] text-green-500">Vendidos</p>
            </div>
          </div>

          {/* Money stats */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-sm font-bold text-green-600">{formatCurrency(c.confirmed_amount)}</p>
              <p className="text-[10px] text-navy-400">Confirmado</p>
            </div>
            <div>
              <p className="text-sm font-bold text-amber-600">{formatCurrency(c.pending_amount)}</p>
              <p className="text-[10px] text-navy-400">Pendiente</p>
            </div>
            <div>
              <p className="text-sm font-bold text-navy-700">{formatCurrency(c.expected_amount)}</p>
              <p className="text-[10px] text-navy-400">Esperado</p>
            </div>
          </div>

          {/* Overdue alert */}
          {c.overdue_installments > 0 && (
            <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {c.overdue_installments} cuotas vencidas ({formatCurrency(c.overdue_amount)})
            </div>
          )}

          {/* Expand button */}
          {c.sellers.length > 0 && (
            <>
              <button
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-medium text-navy-400 hover:text-navy-600"
              >
                {expanded === c.id ? "Ocultar vendedores" : `Ver ${c.sellers.length} vendedores`}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-3 w-3 transition-transform ${expanded === c.id ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expanded === c.id && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-navy-100 text-xs text-navy-400">
                        <th className="pb-2 pr-3 font-medium">Vendedor</th>
                        <th className="pb-2 pr-3 text-right font-medium">Res.</th>
                        <th className="pb-2 pr-3 text-right font-medium">Vend.</th>
                        <th className="pb-2 pr-3 text-right font-medium">Cobrado</th>
                        <th className="pb-2 text-right font-medium">Pendiente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.sellers.map((s) => (
                        <tr key={s.id} className="border-b border-navy-50">
                          <td className="py-2 pr-3">
                            <p className="font-medium text-navy-700">{s.name}</p>
                            {s.code && <p className="text-[10px] font-mono text-navy-400">{s.code}</p>}
                          </td>
                          <td className="py-2 pr-3 text-right text-amber-600">{s.reserved}</td>
                          <td className="py-2 pr-3 text-right text-green-600">{s.sold}</td>
                          <td className="py-2 pr-3 text-right text-green-600">{formatCurrency(s.confirmed_amount)}</td>
                          <td className="py-2 text-right text-amber-600">{formatCurrency(s.pending_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
