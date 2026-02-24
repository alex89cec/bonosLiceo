"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface ReservationResult {
  reservation_id: string;
  ticket_number: string;
  campaign_name: string;
  status: string;
  expires_at: string;
  payment_status: string;
  payment_mode: string;
  amount: number;
}

export default function MisNumerosPage() {
  const [email, setEmail] = useState("");
  const [reservationId, setReservationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReservationResult | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: reservationId,
          buyer_email: email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se encontro la reserva");
        setLoading(false);
        return;
      }

      setResult(data.reservation);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const statusLabels: Record<string, { text: string; color: string }> = {
    active: { text: "Reservado", color: "bg-gold-100 text-gold-800" },
    confirmed: { text: "Confirmado", color: "bg-green-100 text-green-800" },
    cancelled: { text: "Cancelado", color: "bg-gray-100 text-gray-600" },
  };

  const paymentLabels: Record<string, { text: string; color: string }> = {
    pending: { text: "Pendiente", color: "bg-gold-100 text-gold-800" },
    partial: { text: "Parcial", color: "bg-blue-100 text-blue-800" },
    completed: { text: "Pagado", color: "bg-green-100 text-green-800" },
  };

  return (
    <main className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-navy-700 px-4 pb-6 pt-5">
        <div className="absolute left-0 right-0 top-0 h-1.5 bg-gold-500" />
        <div className="mx-auto max-w-md">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1 text-sm text-navy-200 hover:text-white"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Inicio
          </Link>
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="CEC Liceo Militar"
              width={120}
              height={31}
              className="drop-shadow"
            />
          </div>
          <h1 className="mt-3 text-xl font-bold text-white">Mis Bonos</h1>
          <p className="text-sm text-navy-200">
            Consulta el estado de tu bono
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <form onSubmit={handleLookup} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-semibold text-navy-700"
            >
              Correo electronico
            </label>
            <input
              id="email"
              type="email"
              className="input-field"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div>
            <label
              htmlFor="reservationId"
              className="mb-1.5 block text-sm font-semibold text-navy-700"
            >
              ID de reserva
            </label>
            <input
              id="reservationId"
              type="text"
              className="input-field font-mono"
              placeholder="ej: abc123-def456-..."
              value={reservationId}
              onChange={(e) => setReservationId(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-navy-400">
              Lo recibiste al momento de reservar
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button className="btn-gold w-full" disabled={loading || !email || !reservationId}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
                Buscando...
              </span>
            ) : (
              "Consultar reserva"
            )}
          </button>
        </form>

        {/* Result */}
        {result && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm">
            {/* Ticket number header */}
            <div className="bg-navy-700 px-5 py-4 text-center">
              <p className="text-sm text-navy-200">Número</p>
              <p className="font-mono text-4xl font-bold text-gold-400">
                #{result.ticket_number}
              </p>
            </div>

            {/* Details */}
            <div className="divide-y divide-navy-50 px-5">
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-navy-400">Campaña</span>
                <span className="text-sm font-semibold text-navy-700">
                  {result.campaign_name}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-navy-400">Estado</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusLabels[result.status]?.color || "bg-gray-100 text-gray-600"}`}
                >
                  {statusLabels[result.status]?.text || result.status}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-navy-400">Pago</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentLabels[result.payment_status]?.color || "bg-gray-100 text-gray-600"}`}
                >
                  {paymentLabels[result.payment_status]?.text ||
                    result.payment_status}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-navy-400">Monto</span>
                <span className="text-sm font-bold text-navy-700">
                  ${result.amount}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-navy-400">Modo</span>
                <span className="text-sm text-navy-600">
                  {result.payment_mode === "full_payment"
                    ? "Pago completo"
                    : "Cuotas"}
                </span>
              </div>
            </div>

            {/* Warning if pending */}
            {result.payment_status === "pending" &&
              result.status === "active" && (
                <div className="mx-5 mb-4 mt-2 rounded-xl bg-gold-50 p-3">
                  <p className="text-sm font-medium text-gold-800">
                    Contacta al vendedor para completar el pago.
                  </p>
                </div>
              )}
          </div>
        )}
      </div>
    </main>
  );
}
