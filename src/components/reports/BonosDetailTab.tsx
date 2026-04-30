"use client";

import { useMemo, useState } from "react";
import type { BonosDetailRow } from "@/types/reports";
import { formatCurrency } from "@/lib/format";
import EditableEmailCell from "./EditableEmailCell";
import SellerPickerCell, {
  type SellerOption,
} from "./SellerPickerCell";

interface Props {
  data: BonosDetailRow[];
  isAdmin: boolean;
  sellers: SellerOption[];
}

const STATUS_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "confirmed", label: "Vendidos" },
  { key: "active", label: "Reservados" },
  { key: "cancelled", label: "Cancelados" },
] as const;

type StatusKey = (typeof STATUS_FILTERS)[number]["key"];

export default function BonosDetailTab({ data, isAdmin, sellers }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  // Local overrides so the table reflects edits without a refetch
  const [emailOverrides, setEmailOverrides] = useState<Record<string, string>>(
    {},
  );
  const [sellerOverrides, setSellerOverrides] = useState<
    Record<
      string,
      { id: string | null; name: string | null; code: string | null }
    >
  >({});

  const campaigns = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of data) map.set(r.campaign_id, r.campaign_name);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const filtered = useMemo(() => {
    let result = data.map((r) => {
      const sellerOverride = sellerOverrides[r.id];
      return {
        ...r,
        buyer_email: emailOverrides[r.id] || r.buyer_email,
        seller_id: sellerOverride
          ? sellerOverride.id
          : r.seller_id,
        seller_name: sellerOverride
          ? sellerOverride.name
          : r.seller_name,
        seller_code: sellerOverride
          ? sellerOverride.code
          : r.seller_code,
      };
    });

    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (campaignFilter !== "all") {
      result = result.filter((r) => r.campaign_id === campaignFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.ticket_number.includes(q) ||
          r.buyer_email.toLowerCase().includes(q) ||
          (r.buyer_name && r.buyer_name.toLowerCase().includes(q)) ||
          (r.seller_code && r.seller_code.toLowerCase().includes(q)) ||
          (r.seller_name && r.seller_name.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [data, statusFilter, campaignFilter, search, emailOverrides, sellerOverrides]);

  const counts = useMemo(() => {
    return {
      all: data.length,
      confirmed: data.filter((r) => r.status === "confirmed").length,
      active: data.filter((r) => r.status === "active").length,
      cancelled: data.filter((r) => r.status === "cancelled").length,
    };
  }, [data]);

  return (
    <div className="space-y-3">
      {/* Status pills + counts */}
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

      {/* Search + campaign filter */}
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
            placeholder="Buscar número, comprador, email, vendedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field sm:max-w-xs"
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
        >
          <option value="all">Todas las campañas</option>
          {campaigns.map(([id, name]) => (
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
              <th className="px-3 py-2">N°</th>
              <th className="px-3 py-2">Campaña</th>
              <th className="px-3 py-2">Comprador</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Vendedor</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Pago</th>
              <th className="px-3 py-2 text-right">Monto</th>
              <th className="px-3 py-2">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-50">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-navy-50/30">
                <td className="px-3 py-2">
                  <span className="rounded bg-navy-100 px-1.5 py-0.5 font-mono text-xs font-bold text-navy-700">
                    #{r.ticket_number}
                  </span>
                </td>
                <td className="max-w-[180px] px-3 py-2">
                  <p className="truncate text-xs text-navy-600">
                    {r.campaign_name}
                  </p>
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.buyer_name || (
                    <span className="text-navy-300">Sin nombre</span>
                  )}
                </td>
                <td className="max-w-[220px] px-3 py-2">
                  <EditableEmailCell
                    email={r.buyer_email}
                    endpoint={`/api/admin/reservations/${r.id}/buyer-email`}
                    disabled={!isAdmin}
                    onSaved={(newEmail) =>
                      setEmailOverrides((prev) => ({
                        ...prev,
                        [r.id]: newEmail,
                      }))
                    }
                  />
                </td>
                <td className="min-w-[140px] max-w-[180px] px-3 py-2 text-xs">
                  <SellerPickerCell
                    currentSellerId={r.seller_id}
                    currentSellerName={r.seller_name}
                    currentSellerCode={r.seller_code}
                    sellers={sellers}
                    endpoint={`/api/admin/reservations/${r.id}/seller`}
                    disabled={!isAdmin}
                    onSaved={(seller) =>
                      setSellerOverrides((prev) => ({
                        ...prev,
                        [r.id]: {
                          id: seller?.id || null,
                          name: seller?.full_name || null,
                          code: seller?.seller_code || null,
                        },
                      }))
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <ResStatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2">
                  {r.payment_status ? (
                    <PaymentBadge status={r.payment_status} />
                  ) : (
                    <span className="text-[10px] text-navy-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-xs font-semibold text-navy-700">
                  {formatCurrency(r.amount)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-[10px] text-navy-400">
                  {new Date(r.created_at).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
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
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-navy-100 px-1.5 py-0.5 font-mono text-xs font-bold text-navy-700">
                  #{r.ticket_number}
                </span>
                <ResStatusBadge status={r.status} />
              </div>
              <span className="text-sm font-bold text-navy-700">
                {formatCurrency(r.amount)}
              </span>
            </div>
            <p className="truncate text-xs text-navy-500">{r.campaign_name}</p>
            <p className="mt-1 text-sm font-medium text-navy-700">
              {r.buyer_name || "Sin nombre"}
            </p>
            <div className="mt-1">
              <EditableEmailCell
                email={r.buyer_email}
                endpoint={`/api/admin/reservations/${r.id}/buyer-email`}
                disabled={!isAdmin}
                onSaved={(newEmail) =>
                  setEmailOverrides((prev) => ({
                    ...prev,
                    [r.id]: newEmail,
                  }))
                }
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
              {r.payment_status && <PaymentBadge status={r.payment_status} />}
              <span className="text-navy-400">
                {new Date(r.created_at).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                })}
              </span>
            </div>
            {/* Seller picker (mobile) */}
            <div className="mt-2 border-t border-navy-100 pt-2">
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-navy-400">
                Vendedor
              </p>
              <SellerPickerCell
                currentSellerId={r.seller_id}
                currentSellerName={r.seller_name}
                currentSellerCode={r.seller_code}
                sellers={sellers}
                endpoint={`/api/admin/reservations/${r.id}/seller`}
                disabled={!isAdmin}
                onSaved={(seller) =>
                  setSellerOverrides((prev) => ({
                    ...prev,
                    [r.id]: {
                      id: seller?.id || null,
                      name: seller?.full_name || null,
                      code: seller?.seller_code || null,
                    },
                  }))
                }
              />
            </div>
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

function ResStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; bg: string; text: string }> = {
    active: {
      label: "Reservado",
      bg: "bg-amber-100",
      text: "text-amber-700",
    },
    confirmed: {
      label: "Vendido",
      bg: "bg-green-100",
      text: "text-green-700",
    },
    cancelled: {
      label: "Cancelado",
      bg: "bg-gray-100",
      text: "text-gray-600",
    },
  };
  const c = cfg[status] || { label: status, bg: "bg-gray-100", text: "text-gray-600" };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; bg: string; text: string }> = {
    pending: {
      label: "Sin pago",
      bg: "bg-yellow-100",
      text: "text-yellow-700",
    },
    partial: {
      label: "Parcial",
      bg: "bg-blue-100",
      text: "text-blue-700",
    },
    completed: {
      label: "Pagado",
      bg: "bg-green-100",
      text: "text-green-700",
    },
  };
  const c = cfg[status] || { label: status, bg: "bg-gray-100", text: "text-gray-600" };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}
