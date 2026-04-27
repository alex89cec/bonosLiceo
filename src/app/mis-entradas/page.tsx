"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { formatCurrency } from "@/lib/format";

interface TicketRow {
  id: string;
  qr_token: string;
  status: string;
  amount_paid: number | null;
  entered_at: string | null;
  parent_bundle_type_id: string | null;
  events: {
    id: string;
    name: string;
    slug: string;
    event_date: string;
    venue: string | null;
    image_url: string | null;
  } | null;
  ticket_type: { id: string; name: string; color: string | null } | null;
  parent_bundle: { id: string; name: string } | null;
}

interface OrderRow {
  id: string;
  status: string;
  total_amount: number;
  items: { name: string; quantity: number }[];
  payment_method: string;
  created_at: string;
  rejection_reason: string | null;
  events: {
    id: string;
    name: string;
    slug: string;
    event_date: string;
    venue: string | null;
  } | null;
}

interface LookupResult {
  buyer: { email: string; name: string | null };
  tickets: TicketRow[];
  orders: OrderRow[];
}

function MisEntradasContent() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LookupResult | null>(null);

  const lookup = useCallback(async (lookupEmail: string) => {
    if (!lookupEmail) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/mis-entradas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: lookupEmail }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al buscar entradas");
        setLoading(false);
        return;
      }
      setData(json);
    } catch {
      setError("Error de red");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialEmail) lookup(initialEmail);
  }, [initialEmail, lookup]);

  // Group tickets by event
  const ticketsByEvent: Record<string, TicketRow[]> = {};
  for (const t of data?.tickets || []) {
    if (!t.events) continue;
    const k = t.events.id;
    (ticketsByEvent[k] ??= []).push(t);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-navy-700 px-4 py-4 text-center">
        <h1 className="text-lg font-bold text-gold-400">Mis entradas</h1>
        <p className="text-xs text-navy-200">
          Ingresá tu email para ver tus entradas con QR
        </p>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Lookup form */}
        <div className="mb-6 rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              lookup(email);
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="email"
              className="input-field flex-1"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              required
            />
            <button
              type="submit"
              className="rounded-xl bg-navy-700 px-6 py-2 text-sm font-bold text-white transition hover:bg-navy-800 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </form>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        {/* Results */}
        {data && (
          <>
            {data.tickets.length === 0 && data.orders.length === 0 && (
              <div className="rounded-2xl border border-navy-100 bg-white p-12 text-center shadow-sm">
                <p className="text-navy-400">No encontramos entradas para este email.</p>
              </div>
            )}

            {/* Pending orders */}
            {data.orders.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
                  Órdenes en proceso
                </h2>
                <div className="space-y-2">
                  {data.orders.map((o) => (
                    <PendingOrderCard key={o.id} order={o} />
                  ))}
                </div>
              </div>
            )}

            {/* Tickets per event */}
            {Object.entries(ticketsByEvent).map(([eventId, evTickets]) => {
              const ev = evTickets[0].events!;
              return (
                <div key={eventId} className="mb-6">
                  <div className="mb-3 rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
                    <h2 className="text-lg font-bold text-navy-700">{ev.name}</h2>
                    <p className="mt-1 text-sm text-navy-400">
                      📅{" "}
                      {new Date(ev.event_date).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {ev.venue && <span> • 📍 {ev.venue}</span>}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {evTickets.map((t) => (
                      <TicketCard key={t.id} ticket={t} />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}

        <p className="mt-8 text-center text-xs text-navy-400">
          ¿Problemas para ver tu entrada? Contactá al organizador.
        </p>
      </main>
    </div>
  );
}

function TicketCard({ ticket }: { ticket: TicketRow }) {
  const isUsed = ticket.status === "used";
  return (
    <div
      className={`overflow-hidden rounded-2xl border-2 ${
        isUsed
          ? "border-gray-300 bg-gray-50"
          : "border-dashed border-navy-300 bg-white"
      } p-4 text-center shadow-sm`}
    >
      <div className="mb-2 flex items-center justify-center gap-2">
        <p className="text-sm font-semibold text-navy-700">
          {ticket.ticket_type?.name || "Entrada"}
        </p>
        {ticket.parent_bundle && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
            📦 {ticket.parent_bundle.name}
          </span>
        )}
        {isUsed && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
            USADA
          </span>
        )}
      </div>

      <div className="inline-block rounded-xl bg-white p-3 shadow-sm">
        <QRCodeSVG
          value={ticket.qr_token}
          size={180}
          level="M"
          fgColor={isUsed ? "#94a3b8" : "#0f172a"}
        />
      </div>

      {isUsed && ticket.entered_at && (
        <p className="mt-2 text-xs text-navy-500">
          Ingresada el{" "}
          {new Date(ticket.entered_at).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}

      <p className="mt-2 font-mono text-[10px] text-navy-400">
        ID: {ticket.id.slice(0, 8)}
      </p>
    </div>
  );
}

function PendingOrderCard({ order }: { order: OrderRow }) {
  const cfg: Record<string, { label: string; bg: string; text: string }> = {
    awaiting_receipt: {
      label: "Esperando comprobante",
      bg: "bg-orange-100",
      text: "text-orange-700",
    },
    pending_review: {
      label: "En revisión",
      bg: "bg-amber-100",
      text: "text-amber-700",
    },
    rejected: { label: "Rechazada", bg: "bg-red-100", text: "text-red-700" },
  };
  const status = cfg[order.status] || {
    label: order.status,
    bg: "bg-gray-100",
    text: "text-gray-700",
  };

  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-navy-700">
            {order.events?.name || "Evento"}
          </p>
          <p className="mt-0.5 text-xs text-navy-400">
            {order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
          </p>
          <p className="mt-1 text-sm font-bold text-navy-700">
            {formatCurrency(order.total_amount)}
          </p>
          {order.rejection_reason && (
            <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
              {order.rejection_reason}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${status.bg} ${status.text}`}
        >
          {status.label}
        </span>
      </div>
    </div>
  );
}

export default function MisEntradasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-200 border-t-gold-500" />
        </div>
      }
    >
      <MisEntradasContent />
    </Suspense>
  );
}
