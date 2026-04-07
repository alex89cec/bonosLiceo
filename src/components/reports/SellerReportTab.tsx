"use client";

import { useState, useMemo } from "react";
import type { SellerReport } from "@/types/reports";
import { formatCurrency } from "@/lib/format";
import { getGroupColor } from "@/lib/group-colors";

export default function SellerReportTab({ data }: { data: SellerReport[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.group_name && s.group_name.toLowerCase().includes(q))
    );
  }, [data, search]);

  if (data.length === 0) {
    return <p className="py-12 text-center text-gray-500">No hay vendedores con actividad.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          className="input-field pl-10"
          placeholder="Buscar vendedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <p className="text-sm text-gray-400">
        Mostrando {filtered.length} de {data.length}
      </p>

      {/* Seller cards */}
      {filtered.map((s) => (
        <div key={s.id} className="card">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-navy-700">{s.name}</h3>
                {s.role === "admin" && (
                  <span className="rounded-full bg-gold-500 px-2 py-0.5 text-xs font-bold text-white">
                    Admin
                  </span>
                )}
                {s.group_name && (() => {
                  const gc = getGroupColor(s.group_color);
                  return (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${gc.bg} ${gc.text}`}>
                      {s.group_name}
                    </span>
                  );
                })()}
              </div>
              <p className="text-xs text-navy-400">
                {s.code && <span className="mr-2 font-mono">{s.code}</span>}
                {s.campaigns_assigned} campañas asignadas
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-amber-50 px-2 py-1.5 text-center">
              <p className="text-lg font-bold text-amber-600">{s.total_reserved}</p>
              <p className="text-[10px] text-amber-500">Reservados</p>
            </div>
            <div className="rounded-lg bg-green-50 px-2 py-1.5 text-center">
              <p className="text-lg font-bold text-green-600">{s.total_sold}</p>
              <p className="text-[10px] text-green-500">Vendidos</p>
            </div>
            <div className="rounded-lg bg-green-50 px-2 py-1.5 text-center">
              <p className="text-sm font-bold text-green-600">{formatCurrency(s.confirmed_amount)}</p>
              <p className="text-[10px] text-green-500">Cobrado</p>
            </div>
            <div className="rounded-lg bg-amber-50 px-2 py-1.5 text-center">
              <p className="text-sm font-bold text-amber-600">{formatCurrency(s.pending_amount)}</p>
              <p className="text-[10px] text-amber-500">Pendiente</p>
            </div>
          </div>

          {/* Expand for per-campaign detail */}
          {s.campaigns.length > 0 && (
            <>
              <button
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-medium text-navy-400 hover:text-navy-600"
              >
                {expanded === s.id ? "Ocultar campañas" : `Ver ${s.campaigns.length} campañas`}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-3 w-3 transition-transform ${expanded === s.id ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expanded === s.id && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-navy-100 text-xs text-navy-400">
                        <th className="pb-2 pr-3 font-medium">Campaña</th>
                        <th className="pb-2 pr-3 text-right font-medium">Res.</th>
                        <th className="pb-2 pr-3 text-right font-medium">Vend.</th>
                        <th className="pb-2 pr-3 text-right font-medium">Cobrado</th>
                        <th className="pb-2 text-right font-medium">Pendiente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.campaigns.map((c) => (
                        <tr key={c.id} className="border-b border-navy-50">
                          <td className="py-2 pr-3">
                            <p className="font-medium text-navy-700">{c.name}</p>
                            <span
                              className={`text-[10px] ${
                                c.status === "active" ? "text-green-600" : "text-gray-400"
                              }`}
                            >
                              {c.status === "active" ? "Activa" : c.status === "sorted" ? "Sorteada" : "Cerrada"}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right text-amber-600">{c.reserved}</td>
                          <td className="py-2 pr-3 text-right text-green-600">{c.sold}</td>
                          <td className="py-2 pr-3 text-right text-green-600">{formatCurrency(c.confirmed_amount)}</td>
                          <td className="py-2 text-right text-amber-600">{formatCurrency(c.pending_amount)}</td>
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
