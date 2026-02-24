"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

interface InstallmentData {
  id: string;
  number: number;
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: string;
}

interface PaymentData {
  id: string;
  amount: number;
  payment_mode: string;
  status: string;
  installments: InstallmentData[];
}

export interface ReservationCardData {
  id: string;
  status: string;
  created_at: string;
  ticket_number: string;
  buyer_email: string;
  buyer_name: string | null;
  campaign_name: string;
  payment: PaymentData;
}

export default function ReservationCard({
  reservation,
}: {
  reservation: ReservationCardData;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null); // null or "full" or installment number
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  const r = reservation;
  const p = r.payment;
  const isPending = p.status === "pending";
  const isPartial = p.status === "partial";
  const isCompleted = p.status === "completed";
  const isInstallments = p.payment_mode === "installments";

  async function confirmPayment(installmentNumber?: number) {
    const key = installmentNumber ? String(installmentNumber) : "full";
    setConfirming(key);
    setError(null);

    try {
      const body: Record<string, unknown> = { reservation_id: r.id };
      if (installmentNumber) {
        body.installment_number = installmentNumber;
      }

      const res = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al confirmar el pago");
        return;
      }

      // Refresh the page to show updated data
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setConfirming(null);
    }
  }

  const statusConfig: Record<string, { text: string; bg: string }> = {
    active: { text: "Pendiente", bg: "bg-yellow-100 text-yellow-700" },
    confirmed: { text: "Confirmado", bg: "bg-green-100 text-green-700" },
    cancelled: { text: "Cancelado", bg: "bg-gray-100 text-gray-600" },
  };

  const paymentConfig: Record<string, { text: string; bg: string }> = {
    pending: { text: "Sin pago", bg: "bg-yellow-100 text-yellow-700" },
    partial: { text: "Parcial", bg: "bg-blue-100 text-blue-700" },
    completed: { text: "Pagado", bg: "bg-green-100 text-green-700" },
  };

  const statusInfo = statusConfig[r.status] || {
    text: r.status,
    bg: "bg-gray-100 text-gray-600",
  };
  const paymentInfo = paymentConfig[p.status] || {
    text: p.status,
    bg: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm">
      {/* Compact header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-navy-50/50"
      >
        <div className="flex items-center gap-3">
          <p className="font-mono text-lg font-bold text-navy-700">
            #{r.ticket_number}
          </p>
          <div>
            <p className="text-sm font-medium text-navy-600">
              {r.buyer_name || r.buyer_email}
            </p>
            {r.buyer_name && (
              <p className="text-xs text-navy-400">{r.buyer_email}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${paymentInfo.bg}`}
          >
            {paymentInfo.text}
          </span>
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

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-navy-100">
          {/* Details grid */}
          <div className="divide-y divide-navy-50 px-4">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs text-navy-400">Campaña</span>
              <span className="text-sm font-medium text-navy-700">
                {r.campaign_name}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs text-navy-400">Estado</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusInfo.bg}`}
              >
                {statusInfo.text}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs text-navy-400">Monto total</span>
              <span className="text-sm font-bold text-navy-700">
                ${p.amount}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs text-navy-400">Modo de pago</span>
              <span className="text-sm text-navy-600">
                {isInstallments ? "Cuotas" : "Pago completo"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs text-navy-400">Fecha</span>
              <span className="text-xs text-navy-500">
                {new Date(r.created_at).toLocaleDateString("es-HN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          {/* Payment actions */}
          {!isCompleted && r.status !== "cancelled" && (
            <div className="border-t border-navy-100 px-4 py-3">
              {!isInstallments ? (
                /* Full payment confirmation */
                <button
                  onClick={() => confirmPayment()}
                  disabled={confirming !== null}
                  className="btn-gold w-full text-sm"
                >
                  {confirming === "full" ? (
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
                      Confirmar pago completo
                    </span>
                  )}
                </button>
              ) : (
                /* Installment list with individual confirmation */
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">
                    Cuotas
                  </p>
                  {p.installments
                    .sort((a, b) => a.number - b.number)
                    .map((inst) => (
                      <div
                        key={inst.id}
                        className={`flex items-center justify-between rounded-lg p-2.5 ${
                          inst.status === "paid" ? "bg-green-50" : "bg-navy-50"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium text-navy-700">
                            Cuota {inst.number}
                          </p>
                          <p className="text-xs text-navy-400">
                            ${inst.amount} — Vence{" "}
                            {new Date(
                              inst.due_date + "T00:00:00",
                            ).toLocaleDateString("es-HN", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </p>
                        </div>
                        {inst.status === "paid" ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
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
                            Pagada
                          </span>
                        ) : (
                          <button
                            onClick={() => confirmPayment(inst.number)}
                            disabled={confirming !== null}
                            className="rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-semibold text-navy-800 transition-colors hover:bg-gold-400 disabled:opacity-50"
                          >
                            {confirming === String(inst.number) ? (
                              <span className="flex items-center gap-1">
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
                                ...
                              </span>
                            ) : (
                              "Marcar pagada"
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}

              {error && (
                <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Completed state */}
          {isCompleted && (
            <div className="border-t border-navy-100 px-4 py-3">
              <div className="flex items-center justify-center gap-2 rounded-lg bg-green-50 p-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-semibold text-green-700">
                  Pago completado
                </span>
              </div>
            </div>
          )}

          {/* QR Code toggle */}
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
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/mis-numeros?email=${encodeURIComponent(r.buyer_email)}&id=${encodeURIComponent(r.id)}`}
                    size={160}
                    level="M"
                  />
                </div>
                <p className="mt-2 text-xs text-navy-300">
                  El comprador puede escanear para ver su reserva
                </p>
              </div>
            )}
          </div>

          {/* Reserve ID */}
          <div className="border-t border-navy-50 px-4 py-2">
            <p className="text-center font-mono text-[10px] text-navy-300">
              ID: {r.id}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
