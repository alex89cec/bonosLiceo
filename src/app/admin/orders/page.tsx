"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";

interface OrderRow {
  id: string;
  event_id: string;
  total_amount: number;
  payment_method: string;
  status: string;
  receipt_url: string | null;
  receipt_filename: string | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  items: { ticket_type_id: string; name: string; quantity: number; unit_price: number }[];
  events: { id: string; name: string; slug: string } | null;
  buyers: { email: string; full_name: string; phone: string | null } | null;
  profiles: { full_name: string; seller_code: string | null } | null;
}

const STATUS_FILTERS = [
  { key: "awaiting_receipt", label: "Esperando comprobante" },
  { key: "pending_review", label: "Pendientes" },
  { key: "approved", label: "Aprobadas" },
  { key: "rejected", label: "Rechazadas" },
  { key: "complimentary", label: "Cortesías" },
] as const;

type StatusKey = (typeof STATUS_FILTERS)[number]["key"];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusKey>("pending_review");
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const fetchOrders = useCallback(async (status: StatusKey) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders?status=${status}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al cargar órdenes");
        setLoading(false);
        return;
      }
      setOrders(json.orders);
      setCanApprove(json.can_approve);
    } catch {
      setError("Error de red");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders(filter);
  }, [filter, fetchOrders]);

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Órdenes</h2>

      {!canApprove && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          ℹ️ Solo podés visualizar órdenes. La aprobación está reservada a aprobadores asignados.
        </div>
      )}

      {/* Filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === s.key
                ? "bg-navy-700 text-white"
                : "border border-navy-200 text-navy-600 hover:bg-navy-50"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-200 border-t-gold-500" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && orders.length === 0 && (
        <p className="py-12 text-center text-sm text-navy-400">
          No hay órdenes en este estado.
        </p>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              isOpen={openOrderId === o.id}
              onToggle={() => setOpenOrderId(openOrderId === o.id ? null : o.id)}
              onAction={() => fetchOrders(filter)}
              canApprove={canApprove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  isOpen,
  onToggle,
  onAction,
  canApprove,
}: {
  order: OrderRow;
  isOpen: boolean;
  onToggle: () => void;
  onAction: () => void;
  canApprove: boolean;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  const isPending = order.status === "pending_review";
  const isAwaitingReceipt = order.status === "awaiting_receipt";

  async function loadReceiptUrl() {
    if (!order.receipt_url || receiptUrl) return;
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`);
      const json = await res.json();
      if (res.ok) setReceiptUrl(json.receipt_signed_url);
    } catch {
      // ignore
    }
  }

  async function approve() {
    setActionLoading("approve");
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/approve`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error || "Error al aprobar");
      } else {
        onAction();
      }
    } catch {
      setActionError("Error de red");
    }
    setActionLoading(null);
  }

  async function reject() {
    if (!rejectReason.trim()) {
      setActionError("Indicá un motivo de rechazo");
      return;
    }
    setActionLoading("reject");
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error || "Error al rechazar");
      } else {
        onAction();
      }
    } catch {
      setActionError("Error de red");
    }
    setActionLoading(null);
  }

  async function uploadReceipt() {
    if (!receiptFile) {
      setActionError("Seleccioná un archivo");
      return;
    }
    setActionLoading("upload");
    setActionError(null);
    try {
      const fd = new FormData();
      fd.append("receipt", receiptFile);
      const res = await fetch(`/api/orders/${order.id}/upload-receipt`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error || "Error al subir comprobante");
      } else {
        setReceiptFile(null);
        onAction();
      }
    } catch {
      setActionError("Error de red");
    }
    setActionLoading(null);
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => {
          onToggle();
          if (!isOpen) loadReceiptUrl();
        }}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy-700">
            {order.buyers?.full_name || "—"}
          </p>
          <p className="text-xs text-navy-400">{order.buyers?.email}</p>
          <p className="mt-1 text-xs text-navy-500">
            {order.events?.name} • {totalQty} entrada{totalQty !== 1 ? "s" : ""} •{" "}
            <span className="font-bold">{formatCurrency(order.total_amount)}</span>
          </p>
          <p className="mt-1 text-[10px] text-navy-400">
            {new Date(order.created_at).toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {order.profiles && (
              <span> • Vendedor: {order.profiles.full_name}</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge status={order.status} />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 text-navy-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-3 border-t border-navy-100 pt-3">
          {/* Items */}
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy-400">
              Detalle
            </p>
            <div className="space-y-1 text-sm">
              {order.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span>
                    {it.quantity}× {it.name}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(it.unit_price * it.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Buyer info */}
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy-400">
              Comprador
            </p>
            <div className="text-sm">
              <p>{order.buyers?.full_name}</p>
              <p className="text-navy-500">{order.buyers?.email}</p>
              {order.buyers?.phone && <p className="text-navy-500">{order.buyers.phone}</p>}
            </div>
          </div>

          {/* Receipt */}
          {order.receipt_url && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy-400">
                Comprobante
              </p>
              {receiptUrl ? (
                <div>
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    Ver comprobante ({order.receipt_filename})
                  </a>
                  {/* Inline preview if image */}
                  {order.receipt_filename?.match(/\.(jpe?g|png|webp)$/i) && (
                    <div className="mt-2 overflow-hidden rounded-xl border border-navy-100">
                      <img
                        src={receiptUrl}
                        alt="Comprobante"
                        className="max-h-96 w-full object-contain"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-navy-400">Cargando...</p>
              )}
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy-400">
                Nota
              </p>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}

          {/* Rejection reason */}
          {order.rejection_reason && (
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-700">Motivo del rechazo</p>
              <p className="text-sm text-red-600">{order.rejection_reason}</p>
            </div>
          )}

          {/* Upload receipt (for awaiting_receipt orders) */}
          {isAwaitingReceipt && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
              <p className="mb-2 text-sm font-semibold text-orange-800">
                📤 Subir comprobante
              </p>
              <p className="mb-3 text-xs text-orange-700">
                Esta orden está esperando el comprobante. Subilo y pasa a revisión.
              </p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="block w-full rounded-xl border border-orange-200 bg-white p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-700 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
              />
              {receiptFile && (
                <p className="mt-2 text-xs text-orange-700">
                  📎 {receiptFile.name} ({(receiptFile.size / 1024).toFixed(0)} KB)
                </p>
              )}
              <button
                onClick={uploadReceipt}
                disabled={!receiptFile || actionLoading !== null}
                className="btn-gold mt-3 w-full text-sm disabled:opacity-50"
              >
                {actionLoading === "upload" ? "Subiendo..." : "Subir y enviar a revisión"}
              </button>
            </div>
          )}

          {/* Actions */}
          {isPending && canApprove && !showRejectForm && (
            <div className="flex gap-2">
              <button
                onClick={approve}
                disabled={actionLoading !== null}
                className="btn-gold flex-1 text-sm"
              >
                {actionLoading === "approve" ? "Aprobando..." : "✓ Aprobar y emitir"}
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                disabled={actionLoading !== null}
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                Rechazar
              </button>
            </div>
          )}

          {isPending && canApprove && showRejectForm && (
            <div className="space-y-2">
              <textarea
                className="input-field min-h-[60px]"
                placeholder="Motivo del rechazo..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={reject}
                  disabled={actionLoading !== null || !rejectReason.trim()}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading === "reject" ? "Rechazando..." : "Confirmar rechazo"}
                </button>
                <button
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectReason("");
                  }}
                  className="btn-secondary text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {actionError && (
            <div className="rounded-xl bg-red-50 p-2 text-xs text-red-600">{actionError}</div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; bg: string }> = {
    awaiting_receipt: { label: "Esperando comprobante", bg: "bg-orange-100 text-orange-700" },
    pending_review: { label: "Pendiente", bg: "bg-amber-100 text-amber-700" },
    approved: { label: "Aprobada", bg: "bg-green-100 text-green-700" },
    rejected: { label: "Rechazada", bg: "bg-red-100 text-red-700" },
    cancelled: { label: "Cancelada", bg: "bg-gray-100 text-gray-600" },
    complimentary: { label: "Cortesía", bg: "bg-blue-100 text-blue-700" },
  };
  const c = cfg[status] || { label: status, bg: "bg-gray-100 text-gray-600" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.bg}`}>
      {c.label}
    </span>
  );
}
