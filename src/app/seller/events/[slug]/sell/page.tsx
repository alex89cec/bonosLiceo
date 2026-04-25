"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Event, EventTicketType } from "@/types/database";
import { formatCurrency } from "@/lib/format";

type Step = "select" | "buyer" | "receipt" | "success";

export default function SellerSellEventPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [types, setTypes] = useState<EventTicketType[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [initLoading, setInitLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("select");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: ev } = await supabase
        .from("events")
        .select("*")
        .eq("slug", slug)
        .single();

      if (!ev) {
        setInitError("Evento no encontrado");
        setInitLoading(false);
        return;
      }
      setEvent(ev as Event);

      const { data: ts } = await supabase
        .from("event_ticket_types")
        .select("*")
        .eq("event_id", ev.id)
        .order("display_order", { ascending: true });

      const ticketTypes = (ts || []) as EventTicketType[];
      setTypes(ticketTypes);

      // Compute remaining stock per type (valid + used + pending in orders)
      const stockResults: Record<string, number> = {};
      for (const t of ticketTypes) {
        const { count: takenCount } = await supabase
          .from("event_tickets")
          .select("id", { count: "exact", head: true })
          .eq("ticket_type_id", t.id)
          .in("status", ["valid", "used"]);

        const { data: pendingOrders } = await supabase
          .from("event_orders")
          .select("items")
          .eq("event_id", ev.id)
          .eq("status", "pending_review");

        let pending = 0;
        for (const o of pendingOrders || []) {
          const items = o.items as { ticket_type_id: string; quantity: number }[];
          for (const it of items) {
            if (it.ticket_type_id === t.id) pending += it.quantity;
          }
        }
        stockResults[t.id] = Math.max(0, t.quantity - (takenCount || 0) - pending);
      }
      setStockMap(stockResults);
      setInitLoading(false);
    }
    init();
  }, [slug]);

  const totalQty = Object.values(quantities).reduce((s, q) => s + q, 0);
  const totalAmount = Object.entries(quantities).reduce((sum, [tid, qty]) => {
    const t = types.find((x) => x.id === tid);
    return sum + (t ? Number(t.price) * qty : 0);
  }, 0);

  function setQty(typeId: string, q: number) {
    const max = stockMap[typeId] ?? 0;
    const clamped = Math.max(0, Math.min(q, max));
    setQuantities((prev) => {
      const next = { ...prev };
      if (clamped === 0) delete next[typeId];
      else next[typeId] = clamped;
      return next;
    });
  }

  async function submit() {
    if (!event) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const items = Object.entries(quantities).map(([ticket_type_id, quantity]) => ({
        ticket_type_id,
        quantity,
      }));

      const data = {
        buyer_email: buyerEmail,
        buyer_name: buyerName,
        buyer_phone: buyerPhone || null,
        items,
        payment_method: "transferencia",
        notes: notes || null,
      };

      const formData = new FormData();
      formData.append("data", JSON.stringify(data));
      if (receipt) formData.append("receipt", receipt);

      const res = await fetch(`/api/events/${event.id}/orders`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || "Error al crear la orden");
        setSubmitting(false);
        return;
      }

      setStep("success");
    } catch {
      setSubmitError("Error de red. Intentá de nuevo.");
    }
    setSubmitting(false);
  }

  if (initLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-200 border-t-gold-500" />
      </div>
    );
  }

  if (initError || !event) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-red-600">{initError}</p>
        <Link href="/seller/events" className="btn-secondary mt-4 inline-block">
          Volver
        </Link>
      </div>
    );
  }

  // Step 1 — Select types & quantities
  if (step === "select") {
    return (
      <div>
        <Link
          href="/seller/events"
          className="mb-3 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </Link>

        <h2 className="text-xl font-bold text-navy-700">{event.name}</h2>
        <p className="mb-4 text-sm text-navy-400">
          {new Date(event.event_date).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {event.venue && <span> • {event.venue}</span>}
        </p>

        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
          Elegí tipos de entrada
        </h3>

        <div className="space-y-2">
          {types.length === 0 && (
            <p className="py-8 text-center text-sm text-navy-400">
              Este evento no tiene tipos de entrada definidos.
            </p>
          )}
          {types
            .filter((t) => !t.is_complimentary) // hide cortesia from seller
            .map((t) => {
              const qty = quantities[t.id] || 0;
              const remaining = stockMap[t.id] ?? 0;
              const soldOut = remaining === 0 && qty === 0;

              return (
                <div key={t.id} className="card">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy-700">{t.name}</p>
                      {t.description && (
                        <p className="text-xs text-navy-400">{t.description}</p>
                      )}
                      <p className="mt-1 text-sm">
                        <span className="font-bold text-gold-600">
                          {formatCurrency(t.price)}
                        </span>
                        <span className="ml-2 text-xs text-navy-400">
                          {soldOut ? "Agotado" : `${remaining} disponibles`}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQty(t.id, qty - 1)}
                        disabled={qty === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-navy-200 text-navy-600 disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-bold">{qty}</span>
                      <button
                        onClick={() => setQty(t.id, qty + 1)}
                        disabled={qty >= remaining}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-700 text-white disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {totalQty > 0 && (
          <div className="sticky bottom-0 mt-4 bg-gray-50 pb-4 pt-2">
            <div className="card mb-3 flex items-center justify-between">
              <span className="text-sm text-navy-400">Total</span>
              <span className="text-xl font-bold text-navy-700">
                {formatCurrency(totalAmount)}
              </span>
            </div>
            <button className="btn-gold w-full" onClick={() => setStep("buyer")}>
              Continuar ({totalQty} {totalQty === 1 ? "entrada" : "entradas"})
            </button>
          </div>
        )}
      </div>
    );
  }

  // Step 2 — Buyer info
  if (step === "buyer") {
    return (
      <div>
        <button
          onClick={() => setStep("select")}
          className="mb-3 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Cambiar selección
        </button>

        <h2 className="mb-4 text-xl font-bold text-navy-700">Datos del comprador</h2>

        <div className="card space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-navy-700">
              Correo electrónico *
            </label>
            <input
              id="email"
              type="email"
              className="input-field"
              placeholder="comprador@email.com"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-navy-700">
              Nombre y apellido *
            </label>
            <input
              id="name"
              type="text"
              className="input-field"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold text-navy-700">
              Teléfono <span className="font-normal text-navy-300">(opcional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              className="input-field"
              placeholder="+54 11 1234 5678"
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              autoComplete="tel"
              inputMode="tel"
            />
          </div>
        </div>

        <button
          className="btn-gold mt-4 w-full"
          disabled={
            !buyerEmail ||
            !buyerName ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)
          }
          onClick={() => setStep("receipt")}
        >
          Continuar
        </button>
      </div>
    );
  }

  // Step 3 — Receipt + submit
  if (step === "receipt") {
    return (
      <div>
        <button
          onClick={() => setStep("buyer")}
          className="mb-3 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>

        <h2 className="mb-2 text-xl font-bold text-navy-700">Comprobante de transferencia</h2>
        <p className="mb-4 text-sm text-navy-400">
          Subí el comprobante de la transferencia. Un administrador va a revisarlo y aprobar la venta.
        </p>

        {/* Resumen */}
        <div className="card mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy-400">
            Resumen
          </p>
          {Object.entries(quantities).map(([tid, qty]) => {
            const t = types.find((x) => x.id === tid);
            if (!t) return null;
            return (
              <div key={tid} className="flex items-center justify-between py-1 text-sm">
                <span>
                  {qty}× {t.name}
                </span>
                <span className="font-bold">{formatCurrency(Number(t.price) * qty)}</span>
              </div>
            );
          })}
          <div className="mt-2 flex items-center justify-between border-t border-navy-100 pt-2 text-base">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-navy-700">{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        {/* Receipt upload */}
        <div className="card">
          <label className="mb-2 block text-sm font-semibold text-navy-700">
            Comprobante (PDF, JPG, PNG, WEBP — máx 5MB) *
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setReceipt(e.target.files?.[0] || null)}
            className="block w-full rounded-xl border border-navy-200 bg-white p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-700 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
          />
          {receipt && (
            <p className="mt-2 text-xs text-navy-500">
              📎 {receipt.name} ({(receipt.size / 1024).toFixed(0)} KB)
            </p>
          )}
        </div>

        <div className="card mt-4">
          <label htmlFor="notes" className="mb-1.5 block text-sm font-semibold text-navy-700">
            Nota para el admin <span className="font-normal text-navy-300">(opcional)</span>
          </label>
          <textarea
            id="notes"
            className="input-field min-h-[60px]"
            placeholder="Ej: Transferencia desde caja de ahorro..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {submitError && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
            {submitError}
          </div>
        )}

        <button
          className="btn-gold mt-4 w-full"
          disabled={!receipt || submitting}
          onClick={submit}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
              Enviando...
            </span>
          ) : (
            "Enviar para aprobación"
          )}
        </button>
      </div>
    );
  }

  // Step 4 — Success
  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="mb-1 text-xl font-bold text-navy-700">Orden enviada</h2>
      <p className="mb-6 text-sm text-navy-400">
        El administrador va a revisar el comprobante. Cuando se apruebe, el comprador recibirá las entradas por email.
      </p>

      <div className="flex gap-3">
        <button
          className="btn-secondary flex-1"
          onClick={() => {
            setQuantities({});
            setBuyerEmail("");
            setBuyerName("");
            setBuyerPhone("");
            setReceipt(null);
            setNotes("");
            setSubmitError(null);
            setStep("select");
            // Refetch stock
            router.refresh();
          }}
        >
          Vender otra
        </button>
        <Link href="/seller/events" className="btn-primary flex-1 text-center">
          Volver
        </Link>
      </div>
    </div>
  );
}
