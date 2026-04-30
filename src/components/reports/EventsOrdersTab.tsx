"use client";

import { useMemo, useState } from "react";
import type { EventOrderRow } from "@/types/reports";
import { formatCurrency } from "@/lib/format";
import EditableEmailCell from "./EditableEmailCell";
import SellerPickerCell, {
  type SellerOption,
} from "./SellerPickerCell";
import FilterSelect from "./FilterSelect";

interface Props {
  data: EventOrderRow[];
  isAdmin: boolean;
  sellers: SellerOption[];
}

const STATUS_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "approved", label: "Aprobadas" },
  { key: "pending_review", label: "Pendientes" },
  { key: "awaiting_receipt", label: "Sin comprobante" },
  { key: "rejected", label: "Rechazadas" },
  { key: "complimentary", label: "Cortesías" },
] as const;

type StatusKey = (typeof STATUS_FILTERS)[number]["key"];

export default function EventsOrdersTab({ data, isAdmin, sellers }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
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
    for (const o of data) map.set(o.event_id, o.event_name);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const filtered = useMemo(() => {
    let result = data.map((o) => {
      const so = sellerOverrides[o.id];
      return {
        ...o,
        buyer_email: emailOverrides[o.id] || o.buyer_email,
        seller_id: so ? so.id : o.seller_id,
        seller_name: so ? so.name : o.seller_name,
        seller_code: so ? so.code : o.seller_code,
      };
    });
    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter);
    }
    if (eventFilter !== "all") {
      result = result.filter((o) => o.event_id === eventFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (o) =>
          o.buyer_email.toLowerCase().includes(q) ||
          (o.buyer_name && o.buyer_name.toLowerCase().includes(q)) ||
          (o.seller_name && o.seller_name.toLowerCase().includes(q)) ||
          (o.seller_code && o.seller_code.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [data, statusFilter, eventFilter, search, emailOverrides, sellerOverrides]);

  const counts = useMemo(() => {
    return {
      all: data.length,
      approved: data.filter((o) => o.status === "approved").length,
      pending_review: data.filter((o) => o.status === "pending_review").length,
      awaiting_receipt: data.filter((o) => o.status === "awaiting_receipt")
        .length,
      rejected: data.filter((o) => o.status === "rejected").length,
      complimentary: data.filter((o) => o.status === "complimentary").length,
    };
  }, [data]);

  return (
    <div className="space-y-3">
      {/* Filters: search + status + event — all in one wrap row */}
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
            placeholder="Buscar comprador, email, vendedor..."
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
          onChange={setEventFilter}
          options={[
            { value: "all", label: "Todos" },
            ...events.map(([id, name]) => ({ value: id, label: name })),
          ]}
        />
      </div>

      <p className="text-xs text-navy-400">
        Mostrando {filtered.length} de {data.length}
      </p>

      {/* Cards (no table — orders have multi-line items, easier as cards) */}
      <div className="space-y-2">
        {filtered.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            isAdmin={isAdmin}
            sellers={sellers}
            onEmailSaved={(email) =>
              setEmailOverrides((prev) => ({ ...prev, [o.id]: email }))
            }
            onSellerSaved={(seller) =>
              setSellerOverrides((prev) => ({
                ...prev,
                [o.id]: {
                  id: seller?.id || null,
                  name: seller?.full_name || null,
                  code: seller?.seller_code || null,
                },
              }))
            }
          />
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

function OrderCard({
  order,
  isAdmin,
  sellers,
  onEmailSaved,
  onSellerSaved,
}: {
  order: EventOrderRow;
  isAdmin: boolean;
  sellers: SellerOption[];
  onEmailSaved: (email: string) => void;
  onSellerSaved: (seller: SellerOption | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  const dateStr = new Date(order.created_at).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-navy-50/40"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-navy-700">
              {order.buyer_name || "Sin nombre"}
            </p>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="truncate text-xs text-navy-500">{order.event_name}</p>
          <p className="mt-0.5 text-[10px] text-navy-400">
            {totalQty} {totalQty === 1 ? "entrada" : "entradas"} ·{" "}
            <span className="font-semibold text-navy-600">
              {formatCurrency(order.total_amount)}
            </span>{" "}
            · {dateStr}
            {order.seller_code && <span> · {order.seller_code}</span>}
          </p>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 shrink-0 text-navy-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-navy-100 px-3 py-3 text-xs">
          {/* Buyer */}
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-navy-400">
              Comprador
            </p>
            <p className="text-sm text-navy-700">
              {order.buyer_name || "Sin nombre"}
            </p>
            <div className="mt-0.5">
              <EditableEmailCell
                email={order.buyer_email}
                endpoint={`/api/admin/orders/${order.id}/buyer-email`}
                disabled={!isAdmin}
                onSaved={onEmailSaved}
              />
            </div>
          </div>

          {/* Seller — picker for admin, display for others */}
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-navy-400">
              Vendedor
            </p>
            <SellerPickerCell
              currentSellerId={order.seller_id}
              currentSellerName={order.seller_name}
              currentSellerCode={order.seller_code}
              sellers={sellers}
              endpoint={`/api/admin/orders/${order.id}/seller`}
              disabled={!isAdmin}
              onSaved={onSellerSaved}
            />
          </div>

          {/* Items */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy-400">
              Detalle
            </p>
            <div className="space-y-0.5">
              {order.items.map((it, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-navy-600"
                >
                  <span>
                    {it.quantity}× {it.is_bundle && "📦 "}
                    {it.name}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(it.unit_price * it.quantity)}
                  </span>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between border-t border-navy-100 pt-1 font-bold text-navy-700">
                <span>Total</span>
                <span>{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Receipt */}
          {order.receipt_filename && (
            <p className="text-navy-500">📎 {order.receipt_filename}</p>
          )}

          {/* Rejection reason */}
          {order.rejection_reason && (
            <div className="rounded-lg bg-red-50 p-2 text-red-700">
              <p className="font-semibold">Motivo del rechazo:</p>
              <p>{order.rejection_reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; bg: string; text: string }> = {
    awaiting_receipt: {
      label: "Sin comprobante",
      bg: "bg-orange-100",
      text: "text-orange-700",
    },
    pending_review: {
      label: "Pendiente",
      bg: "bg-amber-100",
      text: "text-amber-700",
    },
    approved: { label: "Aprobada", bg: "bg-green-100", text: "text-green-700" },
    rejected: { label: "Rechazada", bg: "bg-red-100", text: "text-red-700" },
    cancelled: {
      label: "Cancelada",
      bg: "bg-gray-100",
      text: "text-gray-600",
    },
    complimentary: {
      label: "Cortesía",
      bg: "bg-blue-100",
      text: "text-blue-700",
    },
  };
  const c = cfg[status] || { label: status, bg: "bg-gray-100", text: "text-gray-600" };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}
