"use client";

import { useMemo, useState } from "react";
import type { EventTicketDetailRow } from "@/types/reports";
import { formatCurrency } from "@/lib/format";
import EditableEmailCell from "./EditableEmailCell";

interface Props {
  data: EventTicketDetailRow[];
  isAdmin: boolean;
}

const STATUS_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "valid", label: "Válidas" },
  { key: "used", label: "Usadas" },
  { key: "cancelled", label: "Canceladas" },
  { key: "refunded", label: "Reembolsadas" },
] as const;

type StatusKey = (typeof STATUS_FILTERS)[number]["key"];

export default function EventsDetailTab({ data, isAdmin }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  // emailOverrides keyed by ORDER_ID — when one ticket gets its email updated,
  // all sibling tickets from the same order pick it up.
  const [emailOverrides, setEmailOverrides] = useState<Record<string, string>>(
    {},
  );

  const events = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of data) map.set(r.event_id, r.event_name);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const types = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of data) {
      // When event filter is set, restrict types to that event's types
      if (eventFilter !== "all" && r.event_id !== eventFilter) continue;
      map.set(r.ticket_type_id, r.ticket_type_name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data, eventFilter]);

  const filtered = useMemo(() => {
    let result = data.map((r) => ({
      ...r,
      buyer_email:
        (r.order_id && emailOverrides[r.order_id]) || r.buyer_email,
    }));

    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (eventFilter !== "all") {
      result = result.filter((r) => r.event_id === eventFilter);
    }
    if (typeFilter !== "all") {
      result = result.filter((r) => r.ticket_type_id === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.short_id.toLowerCase().includes(q) ||
          r.buyer_email.toLowerCase().includes(q) ||
          (r.buyer_name && r.buyer_name.toLowerCase().includes(q)) ||
          (r.seller_name && r.seller_name.toLowerCase().includes(q)) ||
          (r.seller_code && r.seller_code.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [data, statusFilter, eventFilter, typeFilter, search, emailOverrides]);

  const counts = useMemo(() => {
    return {
      all: data.length,
      valid: data.filter((r) => r.status === "valid").length,
      used: data.filter((r) => r.status === "used").length,
      cancelled: data.filter((r) => r.status === "cancelled").length,
      refunded: data.filter((r) => r.status === "refunded").length,
    };
  }, [data]);

  return (
    <div className="space-y-3">
      {/* Status filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === key
                ? "bg-navy-700 text-white"
                : "border border-navy-200 text-navy-600 hover:bg-navy-50"
            }`}
          >
            {label}
            <span className="ml-1 opacity-70">{counts[key]}</span>
          </button>
        ))}
      </div>

      {/* Search + event/type filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
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
            placeholder="Buscar ID, comprador, email, vendedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field sm:max-w-xs"
          value={eventFilter}
          onChange={(e) => {
            setEventFilter(e.target.value);
            setTypeFilter("all"); // reset type when event changes
          }}
        >
          <option value="all">Todos los eventos</option>
          {events.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="input-field sm:max-w-xs"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">Todos los tipos</option>
          {types.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-navy-400">
        Mostrando {filtered.length} de {data.length}
      </p>

      {/* Table — desktop */}
      <div className="hidden overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-navy-50/50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-navy-400">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Evento</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Comprador</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Vendedor</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Pagado</th>
              <th className="px-3 py-2">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-50">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-navy-50/30">
                <td className="px-3 py-2">
                  <span
                    className="font-mono text-[10px] text-navy-500"
                    title={r.id}
                  >
                    {r.short_id}
                  </span>
                </td>
                <td className="max-w-[160px] px-3 py-2">
                  <p className="truncate text-xs text-navy-600">
                    {r.event_name}
                  </p>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-navy-700">
                      {r.ticket_type_name}
                    </span>
                    {r.parent_bundle_type_name && (
                      <span className="rounded-full bg-purple-100 px-1.5 py-0 text-[9px] font-medium text-purple-700">
                        📦 {r.parent_bundle_type_name}
                      </span>
                    )}
                  </div>
                </td>
                <td className="max-w-[140px] px-3 py-2">
                  <p className="truncate text-xs text-navy-700">
                    {r.buyer_name || (
                      <span className="text-navy-300">Sin nombre</span>
                    )}
                  </p>
                </td>
                <td className="max-w-[200px] px-3 py-2">
                  {r.order_id ? (
                    <EditableEmailCell
                      email={r.buyer_email}
                      endpoint={`/api/admin/orders/${r.order_id}/buyer-email`}
                      disabled={!isAdmin}
                      onSaved={(newEmail) =>
                        setEmailOverrides((prev) => ({
                          ...prev,
                          [r.order_id!]: newEmail,
                        }))
                      }
                    />
                  ) : (
                    <span className="text-xs text-navy-400">
                      {r.buyer_email}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.seller_name ? (
                    <div>
                      <p className="text-navy-700">{r.seller_name}</p>
                      {r.seller_code && (
                        <p className="font-mono text-[10px] text-navy-400">
                          {r.seller_code}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-navy-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <TicketStatusBadge
                    status={r.status}
                    isComplimentary={r.is_complimentary}
                  />
                  {r.entered_at && (
                    <p className="mt-0.5 text-[9px] text-navy-400">
                      Ingresó:{" "}
                      {new Date(r.entered_at).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-xs font-medium text-navy-700">
                  {r.amount_paid !== null
                    ? formatCurrency(r.amount_paid)
                    : "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-[10px] text-navy-400">
                  {new Date(r.created_at).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "short",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-navy-400">
            Sin resultados.
          </p>
        )}
      </div>

      {/* Stacked cards — mobile */}
      <div className="space-y-2 md:hidden">
        {filtered.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-navy-100 bg-white p-3 shadow-sm"
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy-700">
                  {r.ticket_type_name}
                </p>
                <p className="truncate text-xs text-navy-500">{r.event_name}</p>
              </div>
              <TicketStatusBadge
                status={r.status}
                isComplimentary={r.is_complimentary}
              />
            </div>
            {r.parent_bundle_type_name && (
              <span className="inline-block rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                📦 {r.parent_bundle_type_name}
              </span>
            )}
            <p className="mt-1.5 text-sm font-medium text-navy-700">
              {r.buyer_name || "Sin nombre"}
            </p>
            <div className="mt-0.5">
              {r.order_id && (
                <EditableEmailCell
                  email={r.buyer_email}
                  endpoint={`/api/admin/orders/${r.order_id}/buyer-email`}
                  disabled={!isAdmin}
                  onSaved={(newEmail) =>
                    setEmailOverrides((prev) => ({
                      ...prev,
                      [r.order_id!]: newEmail,
                    }))
                  }
                />
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-navy-400">
              {r.seller_code && (
                <span className="rounded-full bg-navy-50 px-2 py-0.5 font-mono text-navy-600">
                  {r.seller_code}
                </span>
              )}
              {r.amount_paid !== null && r.amount_paid > 0 && (
                <span className="font-semibold text-navy-600">
                  {formatCurrency(r.amount_paid)}
                </span>
              )}
              <span>{r.short_id}</span>
              <span>
                {new Date(r.created_at).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                })}
              </span>
            </div>
            {r.entered_at && (
              <p className="mt-1 text-[10px] text-green-600">
                ✓ Ingresó{" "}
                {new Date(r.entered_at).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-navy-400">
            Sin resultados.
          </p>
        )}
      </div>
    </div>
  );
}

function TicketStatusBadge({
  status,
  isComplimentary,
}: {
  status: string;
  isComplimentary: boolean;
}) {
  const cfg: Record<string, { label: string; bg: string; text: string }> = {
    valid: {
      label: "Válida",
      bg: "bg-green-100",
      text: "text-green-700",
    },
    used: {
      label: "Usada",
      bg: "bg-gray-100",
      text: "text-gray-600",
    },
    cancelled: {
      label: "Cancelada",
      bg: "bg-red-100",
      text: "text-red-700",
    },
    refunded: {
      label: "Reembolsada",
      bg: "bg-orange-100",
      text: "text-orange-700",
    },
  };
  const c = cfg[status] || {
    label: status,
    bg: "bg-gray-100",
    text: "text-gray-600",
  };
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text}`}
      >
        {c.label}
      </span>
      {isComplimentary && (
        <span className="rounded-full bg-blue-100 px-1.5 py-0 text-[9px] font-medium text-blue-700">
          Cortesía
        </span>
      )}
    </div>
  );
}
