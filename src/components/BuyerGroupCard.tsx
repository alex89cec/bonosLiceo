"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
