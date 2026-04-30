"use client";

import { useMemo, useState } from "react";
import type { EventTicketDetailRow } from "@/types/reports";
import { formatCurrency } from "@/lib/format";
import EditableEmailCell from "./EditableEmailCell";
import SellerPickerCell, {
  type SellerOption,
} from "./SellerPickerCell";
import FilterSelect from "./FilterSelect";

interface Props {
  data: EventTicketDetailRow[];
  isAdmin: boolean;
  sellers: SellerOption[];
}

const STATUS_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "valid", label: "Válidas" },
  { key: "used", label: "Usadas" },
  { key: "cancelled", label: "Canceladas" },
  { key: "refunded", label: "Reembolsadas" },
] as const;

type StatusKey = (typeof STATUS_FILTERS)[number]["key"];

export default function EventsDetailTab({ data, isAdmin, sellers }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  // overrides keyed by ORDER_ID — sibling tickets from the same order share buyer + seller
  const [emailOverrides, setEmailOverrides] = useState<Record<string, string>>(
    {},
  );
  const [sellerOverrides, setSellerOverrides] = useState<
    Record<
      string,
      { id: string | null; name: string | null; code: string | null }
    >
  >({});

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
    let result = data.map((r) => {
      const so = r.order_id ? sellerOverrides[r.order_id] : null;
      return {
        ...r,
        buyer_email:
          (r.order_id && emailOverrides[r.order_id]) || r.buyer_email,
        seller_id: so ? so.id : r.seller_id,
        seller_name: so ? so.name : r.seller_name,
        seller_code: so ? so.code : r.seller_code,
      };
    });

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
  }, [
    data,
    statusFilter,
    eventFilter,
    typeFilter,
    search,
    emailOverrides,
    sellerOverrides,
  ]);

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
      {/* Filters: search + status + event + type — all in one wrap row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <div className="relative min-w-[200px] flex-1">
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

        <FilterSelect
          label="Estado"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusKey)}
          options={STATUS_FILTERS.map((s) => ({
            value: s.key,
            label: `${s.label} (${counts[s.key]})`,
          }))}
        />

        <FilterSelect
          label="Evento"
          value={eventFilter}
          onChange={(v) => {
            setEventFilter(v);
            setTypeFilter("all"); // reset type when event changes
          }}
          options={[
            { value: "all", label: "Todos" },
            ...events.map(([id, name]) => ({ value: id, label: name })),
          ]}
        />

        <FilterSelect
          label="Tipo"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: "all", label: "Todos" },
            ...types.map(([id, name]) => ({ value: id, label: name })),
          ]}
        />
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
                <td className="min-w-[140px] max-w-[180px] px-3 py-2 text-xs">
                  {r.order_id ? (
                    <SellerPickerCell
                      currentSellerId={r.seller_id}
                      currentSellerName={r.seller_name}
                      currentSellerCode={r.seller_code}
                      sellers={sellers}
                      endpoint={`/api/admin/orders/${r.order_id}/seller`}
                      disabled={!isAdmin}
                      onSaved={(seller) =>
                        setSellerOverrides((prev) => ({
                          ...prev,
                          [r.order_id!]: {
                            id: seller?.id || null,
                            name: seller?.full_name || null,
                            code: seller?.seller_code || null,
                          },
                        }))
                      }
                    />
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
            {/* Seller picker (mobile) */}
            {r.order_id && (
              <div className="mt-2 border-t border-navy-100 pt-2">
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-navy-400">
                  Vendedor
                </p>
                <SellerPickerCell
                  currentSellerId={r.seller_id}
                  currentSellerName={r.seller_name}
                  currentSellerCode={r.seller_code}
                  sellers={sellers}
                  endpoint={`/api/admin/orders/${r.order_id}/seller`}
                  disabled={!isAdmin}
                  onSaved={(seller) =>
                    setSellerOverrides((prev) => ({
                      ...prev,
                      [r.order_id!]: {
                        id: seller?.id || null,
                        name: seller?.full_name || null,
                        code: seller?.seller_code || null,
                      },
                    }))
                  }
                />
              </div>
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
