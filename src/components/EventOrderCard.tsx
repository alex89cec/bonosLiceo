"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";

export interface EventOrderCardData {
  id: string;
  status: string; // awaiting_receipt | pending_review | approved | rejected | complimentary | cancelled
  total_amount: number;
  payment_method: string;
  receipt_filename: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  items: { name: string; quantity: number; unit_price: number }[];
  event_name: string;
  buyer_email: string;
  buyer_name: string | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  awaiting_receipt: {
    label: "Esperando comprobante",
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

export default function EventOrderCard({
  order,
}: {
  order: EventOrderCardData;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const status = STATUS_CONFIG[order.status] || {
    label: order.status,
    bg: "bg-gray-100",
    text: "text-gray-600",
  };

  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  const isAwaitingReceipt = order.status === "awaiting_receipt";
  const hasTickets =
    order.status === "approved" || order.status === "complimentary";

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
        setActionError(json.error || "Error al subir");
      } else {
        setReceiptFile(null);
        router.refresh();
      }
    } catch {
      setActionError("Error de red");
    }
    setActionLoading(null);
  }

  async function resendEmail() {
    setActionLoading("resend");
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/regenerate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error || "Error al reenviar");
      } else {
        setActionLoading("resent");
        setTimeout(() => setActionLoading(null), 1500);
        return;
      }
    } catch {
      setActionError("Error de red");
    }
    setActionLoading(null);
  }

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
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-navy-50/50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
              🎟️ Ticket
            </span>
            <p className="text-sm font-medium text-navy-700">
              {order.buyer_name || order.buyer_email}
            </p>
          </div>
          <p className="mt-0.5 text-xs text-navy-400">
            {order.event_name} · {totalQty}{" "}
            {totalQty === 1 ? "entrada" : "entradas"} ·{" "}
            <span className="font-semibold text-navy-600">
              {formatCurrency(order.total_amount)}
            </span>
          </p>
          <p className="mt-0.5 text-[10px] text-navy-300">{dateStr}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.bg} ${status.text}`}
          >
            {status.label}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 text-navy-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-navy-100 px-4 py-3">
          {/* Items */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy-400">
              Detalle
            </p>
            <div className="space-y-0.5 text-sm">
              {order.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-navy-700">
                    {it.quantity}× {it.name}
                  </span>
                  <span className="font-medium text-navy-600">
                    {formatCurrency(it.unit_price * it.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Buyer */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy-400">
              Comprador
            </p>
            <p className="text-sm text-navy-600">{order.buyer_email}</p>
          </div>

          {/* Rejection */}
          {order.rejection_reason && (
            <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">
              <p className="font-semibold">Motivo del rechazo:</p>
              <p>{order.rejection_reason}</p>
            </div>
          )}

          {/* Receipt info (if uploaded) */}
          {order.receipt_filename && (
            <p className="text-xs text-navy-400">
              📎 {order.receipt_filename}
            </p>
          )}

          {/* Actions */}
          {isAwaitingReceipt && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="mb-2 text-xs font-semibold text-orange-800">
                Subir comprobante de transferencia
              </p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="block w-full rounded-lg border border-orange-200 bg-white p-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-navy-700 file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-white"
              />
              {receiptFile && (
                <p className="mt-1 text-[10px] text-orange-700">
                  📎 {receiptFile.name}
                </p>
              )}
              <button
                onClick={uploadReceipt}
                disabled={!receiptFile || actionLoading !== null}
                className="btn-gold mt-2 w-full text-xs disabled:opacity-50"
              >
                {actionLoading === "upload" ? "Subiendo..." : "Subir y enviar a revisión"}
              </button>
            </div>
          )}

          {hasTickets && (
            <button
              onClick={resendEmail}
              disabled={actionLoading !== null}
              className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                actionLoading === "resent"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-navy-200 text-navy-600 hover:bg-navy-50"
              }`}
            >
              {actionLoading === "resend" ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-navy-400 border-t-transparent" />
                  Enviando...
                </>
              ) : actionLoading === "resent" ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Email reenviado
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Reenviar email con QRs
                </>
              )}
            </button>
          )}

          {actionError && (
            <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600">
              {actionError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
