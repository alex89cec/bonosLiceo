"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import ReservationCard, { type ReservationCardData } from "./ReservationCard";

interface BuyerGroupCardProps {
  buyerEmail: string;
  reservations: ReservationCardData[];
}

export default function BuyerGroupCard({
  buyerEmail,
  reservations,
}: BuyerGroupCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const buyerName = reservations[0].buyer_name;

  // Bulk confirmable: full_payment pending OR installments with only last quota remaining
  const bulkConfirmable = reservations.filter((r) => {
    if (r.status === "cancelled" || r.payment.status === "completed") return false;

    if (r.payment.payment_mode === "full_payment") return true;

    // Installments: only if exactly 1 unpaid quota remains (the last one)
    if (r.payment.payment_mode === "installments") {
      const unpaid = r.payment.installments.filter((i) => i.status !== "paid");
      if (unpaid.length === 1) {
        const lastInstallment = r.payment.installments.reduce((max, i) =>
          i.number > max.number ? i : max,
        );
        return unpaid[0].id === lastInstallment.id;
      }
    }

    return false;
  });
  const hasBulkConfirmable = bulkConfirmable.length > 0;

  async function confirmAllPayments() {
    setConfirmingAll(true);
    setError(null);

    let failedCount = 0;
    for (const r of bulkConfirmable) {
      try {
        const body: Record<string, unknown> = { reservation_id: r.id };

        // For installments with last quota remaining, include the installment number
        if (r.payment.payment_mode === "installments") {
          const unpaid = r.payment.installments.filter(
            (i) => i.status !== "paid",
          );
          if (unpaid.length === 1) {
            body.installment_number = unpaid[0].number;
          }
        }

        const res = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    setConfirmingAll(false);

    if (failedCount > 0) {
      setError(`${failedCount} pago(s) no se pudieron confirmar`);
    }

    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm">
      {/* Group header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-navy-50/50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-100 text-sm font-bold text-gold-700">
            {reservations.length}
          </div>
          <div>
            <p className="text-sm font-medium text-navy-600">
              {buyerName || buyerEmail}
            </p>
            {buyerName && (
              <p className="text-xs text-navy-400">{buyerEmail}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 text-navy-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-navy-100">
          {/* Ticket number pills */}
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {reservations.map((r) => (
              <span
                key={r.id}
                className="rounded-full bg-navy-50 px-2 py-0.5 font-mono text-xs font-bold text-navy-600"
              >
                #{r.ticket_number}
              </span>
            ))}
          </div>

          {/* Bulk confirm button */}
          {hasBulkConfirmable && (
            <div className="border-t border-navy-100 px-4 py-3">
              <button
                onClick={confirmAllPayments}
                disabled={confirmingAll}
                className="btn-gold w-full text-sm"
              >
                {confirmingAll ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
                    Confirmando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Confirmar todos ({bulkConfirmable.length} pendiente
                    {bulkConfirmable.length !== 1 ? "s" : ""})
                  </span>
                )}
              </button>
              {error && (
                <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Resend email */}
          <div className="border-t border-navy-100 px-4 py-3">
            <button
              onClick={async () => {
                setEmailStatus("sending");
                try {
                  const activeReservationIds = reservations
                    .filter((r) => r.status !== "cancelled")
                    .map((r) => r.id);
                  if (activeReservationIds.length === 0) {
                    setEmailStatus("error");
                    return;
                  }
                  const res = await fetch("/api/emails/buyer-confirmation", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reservation_ids: activeReservationIds }),
                  });
                  setEmailStatus(res.ok ? "sent" : "error");
                } catch {
                  setEmailStatus("error");
                }
              }}
              disabled={emailStatus === "sending"}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                emailStatus === "sent"
                  ? "bg-green-50 text-green-700"
                  : emailStatus === "error"
                    ? "bg-red-50 text-red-600"
                    : "border border-navy-200 text-navy-600 hover:bg-navy-50"
              }`}
            >
              {emailStatus === "sending" ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-navy-400 border-t-transparent" />
                  Enviando...
                </>
              ) : emailStatus === "sent" ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Email enviado a {buyerEmail}
                </>
              ) : emailStatus === "error" ? (
                "Error — Tocar para reintentar"
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Reenviar email ({reservations.filter((r) => r.status !== "cancelled").length} bonos)
                </>
              )}
            </button>
          </div>

          {/* QR Code toggle — email-only so buyer sees ALL tickets */}
          <div className="border-t border-navy-100 px-4 py-3">
            <button
              onClick={() => setShowQR(!showQR)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-navy-200 px-3 py-2 text-sm font-medium text-navy-600 transition-colors hover:bg-navy-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
              {showQR ? "Ocultar QR" : "Ver QR"}
            </button>
            {showQR && (
              <div className="mt-3 text-center">
                <div className="inline-block rounded-xl bg-white p-3 shadow-sm">
                  <QRCodeSVG
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/mis-numeros?email=${encodeURIComponent(buyerEmail)}`}
                    size={160}
                    level="M"
                  />
                </div>
                <p className="mt-2 text-xs text-navy-300">
                  El comprador puede escanear para ver todas sus reservas
                </p>
              </div>
            )}
          </div>

          {/* Individual cards */}
          <div className="space-y-2 px-3 pb-3">
            {reservations.map((r) => (
              <ReservationCard key={r.id} reservation={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
