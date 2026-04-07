"use client";

import { useState } from "react";
import type { GroupReport } from "@/types/reports";
import { formatCurrency } from "@/lib/format";
import { getGroupColor } from "@/lib/group-colors";

export default function GroupReportTab({ data }: { data: GroupReport[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (data.length === 0) {
    return <p className="py-12 text-center text-gray-500">No hay grupos para mostrar.</p>;
  }

  return (
    <div className="space-y-4">
      {data.map((g) => {
        const gc = getGroupColor(g.color);

        return (
          <div key={g.id} className="card">
            {/* Header with color accent */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-3 w-3 rounded-full ${gc.dot}`} />
                  <h3 className="font-semibold text-navy-700">{g.name}</h3>
                </div>
                <p className="mt-0.5 text-xs text-navy-400">
                  Líder: {g.admin_name} · {g.member_count} miembros · {g.campaigns_assigned} campañas
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-navy-700">{g.total_sold}</p>
                <p className="text-[10px] text-navy-400">vendidos</p>
              </div>
            </div>

            {/* Money stats */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-navy-50 px-2 py-1.5">
                <p className="text-sm font-bold text-navy-700">{formatCurrency(g.total_expected)}</p>
                <p className="text-[10px] text-navy-400">Esperado</p>
              </div>
              <div className="rounded-lg bg-green-50 px-2 py-1.5">
                <p className="text-sm font-bold text-green-600">{formatCurrency(g.confirmed_amount)}</p>
                <p className="text-[10px] text-green-500">Cobrado</p>
              </div>
              <div className="rounded-lg bg-amber-50 px-2 py-1.5">
                <p className="text-sm font-bold text-amber-600">{formatCurrency(g.pending_amount)}</p>
                <p className="text-[10px] text-amber-500">Pendiente</p>
              </div>
            </div>

            {/* Member leaderboard */}
            {g.members.length > 0 && (
              <>
                <button
                  onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                  className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-medium text-navy-400 hover:text-navy-600"
                >
                  {expanded === g.id ? "Ocultar miembros" : `Ver ${g.members.length} miembros`}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-3 w-3 transition-transform ${expanded === g.id ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expanded === g.id && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-navy-100 text-xs text-navy-400">
                          <th className="pb-2 pr-3 font-medium">#</th>
                          <th className="pb-2 pr-3 font-medium">Vendedor</th>
                          <th className="pb-2 pr-3 text-right font-medium">Vendidos</th>
                          <th className="pb-2 pr-3 text-right font-medium">Cobrado</th>
                          <th className="pb-2 text-right font-medium">Pendiente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.members.map((m, i) => (
                          <tr key={m.id} className="border-b border-navy-50">
                            <td className="py-2 pr-3 text-xs text-navy-400">{i + 1}</td>
                            <td className="py-2 pr-3">
                              <p className="font-medium text-navy-700">{m.name}</p>
                              {m.code && <p className="text-[10px] font-mono text-navy-400">{m.code}</p>}
                            </td>
                            <td className="py-2 pr-3 text-right font-semibold text-navy-700">{m.sold}</td>
                            <td className="py-2 pr-3 text-right text-green-600">{formatCurrency(m.confirmed_amount)}</td>
                            <td className="py-2 text-right text-amber-600">{formatCurrency(m.pending_amount)}</td>
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
