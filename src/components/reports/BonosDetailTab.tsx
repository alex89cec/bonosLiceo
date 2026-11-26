"use client";

import { useMemo, useState } from "react";
import type { BonosDetailRow } from "@/types/reports";
import { formatCurrency } from "@/lib/format";
import EditableEmailCell from "./EditableEmailCell";
import SellerPickerCell, {
  type SellerOption,
} from "./SellerPickerCell";
import FilterSelect from "./FilterSelect";

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

const MAIL_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "sent", label: "Enviado" },
  { key: "failed", label: "Falló" },
  { key: "none", label: "Sin registro" },
] as const;

type MailKey = (typeof MAIL_FILTERS)[number]["key"];

type MailState = Pick<
  BonosDetailRow,
  "email_status" | "email_at" | "email_error" | "email_sends"
>;

export default function BonosDetailTab({ data, isAdmin, sellers }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [mailFilter, setMailFilter] = useState<MailKey>("all");
  // Mail state after a resend from this table, so it shows without a refetch
  const [mailOverrides, setMailOverrides] = useState<Record<string, MailState>>(
    {},
  );
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

  const rows = useMemo(
    () =>
      data.map((r) => {
        const sellerOverride = sellerOverrides[r.id];
        return {
          ...r,
          ...mailOverrides[r.id],
          buyer_email: emailOverrides[r.id] || r.buyer_email,
          seller_id: sellerOverride ? sellerOverride.id : r.seller_id,
          seller_name: sellerOverride ? sellerOverride.name : r.seller_name,
          seller_code: sellerOverride ? sellerOverride.code : r.seller_code,
        };
      }),
    [data, emailOverrides, sellerOverrides, mailOverrides],
  );

  const filtered = useMemo(() => {
    let result = rows;

    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (campaignFilter !== "all") {
      result = result.filter((r) => r.campaign_id === campaignFilter);
    }
    if (mailFilter !== "all") {
      result = result.filter((r) =>
        mailFilter === "none"
          ? r.email_status === null
          : r.email_status === mailFilter,
      );
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
  }, [rows, statusFilter, campaignFilter, mailFilter, search]);

  const counts = useMemo(() => {
    return {
      all: data.length,
      confirmed: data.filter((r) => r.status === "confirmed").length,
      active: data.filter((r) => r.status === "active").length,
      cancelled: data.filter((r) => r.status === "cancelled").length,
    };
  }, [data]);

  const mailCounts = useMemo(() => {
    return {
      all: rows.length,
      sent: rows.filter((r) => r.email_status === "sent").length,
      failed: rows.filter((r) => r.email_status === "failed").length,
      none: rows.filter((r) => r.email_status === null).length,
    };
  }, [rows]);

  // One email per buyer+campaign, like the original send: resending a row
  // re-sends every live number that buyer holds in that campaign.
  async function resendMail(row: (typeof rows)[number]): Promise<void> {
    const group = rows.filter(
      (x) =>
        x.buyer_id === row.buyer_id &&
        x.campaign_id === row.campaign_id &&
        x.status !== "cancelled",
    );
    const numbers = group.map((x) => `#${x.ticket_number}`).join(", ");
    if (
      !window.confirm(
        `¿Reenviar el mail de confirmación a ${row.buyer_email}?\nIncluye: ${numbers}`,
      )
    ) {
      return;
    }

    let ok = false;
    let error: string | null = null;
    try {
      const res = await fetch("/api/emails/buyer-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_ids: group.map((x) => x.id) }),
      });
      const json = await res.json().catch(() => ({}));
      ok = res.ok && json.success === true;
      if (!ok) error = json.results?.[0]?.error || json.error || "Error al enviar";
    } catch {
      error = "Error de red";
    }

    const at = new Date().toISOString();
    setMailOverrides((prev) => {
      const next = { ...prev };
      for (const x of group) {
        next[x.id] = {
          email_status: ok ? "sent" : "failed",
          email_at: at,
          email_error: error,
          email_sends: x.email_sends + (ok ? 1 : 0),
        };
      }
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {/* Filters: search + status + campaign — all in one wrap row */}
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
            placeholder="Buscar número, comprador, email, vendedor..."
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
          label="Campaña"
          value={campaignFilter}
          onChange={setCampaignFilter}
          options={[
            { value: "all", label: "Todas" },
            ...campaigns.map(([id, name]) => ({ value: id, label: name })),
          ]}
        />

        <FilterSelect
          label="Mail"
          value={mailFilter}
          onChange={(v) => setMailFilter(v as MailKey)}
          options={MAIL_FILTERS.map((m) => ({
            value: m.key,
            label: `${m.label} (${mailCounts[m.key]})`,
          }))}
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
              <th className="px-3 py-2">N°</th>
              <th className="px-3 py-2">Campaña</th>
              <th className="px-3 py-2">Comprador</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Mail</th>
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
                <td className="whitespace-nowrap px-3 py-2">
                  <MailCell
                    row={r}
                    canResend={isAdmin && r.status !== "cancelled"}
                    onResend={() => resendMail(r)}
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
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-navy-400">
                Mail
              </span>
              <MailCell
                row={r}
                canResend={isAdmin && r.status !== "cancelled"}
                onResend={() => resendMail(r)}
              />
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

function MailCell({
  row,
  canResend,
  onResend,
}: {
  row: MailState;
  canResend: boolean;
  onResend: () => Promise<void>;
}) {
  const [sending, setSending] = useState(false);

  const when = row.email_at
    ? new Date(row.email_at).toLocaleString("es-AR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const badge =
    row.email_status === "sent" ? (
      <span
        className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700"
        title={`Último envío: ${when}${row.email_sends > 1 ? ` · enviado ${row.email_sends} veces` : ""}`}
      >
        Enviado{row.email_sends > 1 ? ` ×${row.email_sends}` : ""}
      </span>
    ) : row.email_status === "failed" ? (
      <span
        className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700"
        title={row.email_error || "El envío falló"}
      >
        Falló
      </span>
    ) : (
      <span
        className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500"
        title="No hay registro de envío. Los mails anteriores a este registro también aparecen así."
      >
        Sin registro
      </span>
    );

  return (
    <div className="flex items-center gap-2">
      <div>
        {badge}
        {when && <p className="mt-0.5 text-[9px] text-navy-400">{when}</p>}
      </div>
      {canResend && (
        <button
          type="button"
          disabled={sending}
          onClick={async () => {
            setSending(true);
            await onResend();
            setSending(false);
          }}
          className="rounded-md border border-navy-200 px-1.5 py-0.5 text-[10px] font-medium text-navy-600 transition hover:border-gold-400 hover:bg-gold-50 disabled:opacity-50"
        >
          {sending ? "Enviando…" : "Reenviar"}
        </button>
      )}
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
