"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Event, EventTicketType } from "@/types/database";
import { formatCurrency } from "@/lib/format";
import ShareEventButton from "@/components/ShareEventButton";

type Step = "select" | "buyer" | "receipt" | "success";

export default function SellerSellEventPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [types, setTypes] = useState<EventTicketType[]>([]);
  /** stockMap[id] is the remaining quantity, or null for unlimited */
  const [stockMap, setStockMap] = useState<Record<string, number | null>>({});
  const [sellerCode, setSellerCode] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("select");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  /** Receipt mode: "now" = upload now, "preventa" = no receipt yet, email transfer data */
  const [receiptMode, setReceiptMode] = useState<"now" | "preventa">("now");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const supabase = createClient();

      // Fetch the seller's own code (for the share link)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("seller_code")
          .eq("id", user.id)
          .single();
        setSellerCode(profile?.seller_code || null);
      }

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

      // Compute remaining stock per type. Bundles count tickets via
      // parent_bundle_type_id and divide by tickets-per-bundle.
      const stockResults: Record<string, number | null> = {};
      for (const t of ticketTypes) {
        if (t.quantity === null) {
          stockResults[t.id] = null;
          continue;
        }

        const isBundle = t.bundle_items && t.bundle_items.length > 0;
        const ticketsPerBundle = isBundle
          ? t.bundle_items!.reduce((s, c) => s + c.quantity, 0)
          : 1;

        const ticketsCountQuery = isBundle
          ? supabase
              .from("event_tickets")
              .select("id", { count: "exact", head: true })
              .eq("parent_bundle_type_id", t.id)
              .in("status", ["valid", "used"])
          : supabase
              .from("event_tickets")
              .select("id", { count: "exact", head: true })
              .eq("ticket_type_id", t.id)
              .is("parent_bundle_type_id", null)
              .in("status", ["valid", "used"]);

        const { count: takenCount } = await ticketsCountQuery;

        const { data: pendingOrders } = await supabase
          .from("event_orders")
          .select("items")
          .eq("event_id", ev.id)
          .in("status", ["pending_review", "awaiting_receipt"]);

        let pending = 0;
        for (const o of pendingOrders || []) {
          const items = o.items as { ticket_type_id: string; quantity: number }[];
          for (const it of items) {
            if (it.ticket_type_id === t.id) pending += it.quantity;
          }
        }

        const occupied = isBundle
          ? Math.ceil((takenCount || 0) / Math.max(ticketsPerBundle, 1))
          : takenCount || 0;
        stockResults[t.id] = Math.max(0, t.quantity - occupied - pending);
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
    const stock = stockMap[typeId];
    // stock null = unlimited; cap at 50 per order to avoid abuse
    const max = stock === null ? 50 : (stock ?? 0);
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
        is_preventa: receiptMode === "preventa",
        notes: notes || null,
      };

      const formData = new FormData();
      formData.append("data", JSON.stringify(data));
      if (receipt && receiptMode === "now") formData.append("receipt", receipt);

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

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-navy-700">{event.name}</h2>
            <p className="text-sm text-navy-400">
              {new Date(event.event_date).toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {event.venue && <span> • {event.venue}</span>}
            </p>
          </div>
          {sellerCode && (
            <ShareEventButton
              eventName={event.name}
              eventSlug={event.slug}
              sellerCode={sellerCode}
            />
          )}
        </div>

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
            .filter((t) => !t.is_complimentary && !t.is_bundle_only)
            .map((t) => {
              const qty = quantities[t.id] || 0;
              const stock = stockMap[t.id];
              const isUnlimited = stock === null;
              const remaining = isUnlimited ? 50 : (stock ?? 0);
              const soldOut = !isUnlimited && remaining === 0 && qty === 0;
              const isBundle = t.bundle_items && t.bundle_items.length > 0;
              const bundleSummary = isBundle
                ? t
                    .bundle_items!.map((bi) => {
                      const comp = types.find((x) => x.id === bi.ticket_type_id);
                      return `${bi.quantity}× ${comp?.name || "?"}`;
                    })
                    .join(" + ")
                : null;

              return (
                <div key={t.id} className="card">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy-700">
                        {isBundle && "📦 "}
                        {t.name}
                      </p>
                      {t.description && (
                        <p className="text-xs text-navy-400">{t.description}</p>
                      )}
                      {bundleSummary && (
                        <p className="mt-0.5 text-xs text-purple-600">
                          Incluye: {bundleSummary}
                        </p>
                      )}
                      <p className="mt-1 text-sm">
                        <span className="font-bold text-gold-600">
                          {formatCurrency(t.price)}
                        </span>
                        <span className="ml-2 text-xs text-navy-400">
                          {soldOut
                            ? "Agotado"
                            : isUnlimited
                              ? "Sin cupo"
                              : `${remaining} disponibles`}
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

        <h2 className="mb-2 text-xl font-bold text-navy-700">Comprobante</h2>
        <p className="mb-4 text-sm text-navy-400">
          Elegí cómo gestionar el comprobante de transferencia.
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

        {/* Mode selector */}
        <div className="card mb-4 space-y-2">
          <p className="mb-1 text-sm font-semibold text-navy-700">¿Tenés el comprobante?</p>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-navy-200 p-3 transition-all has-[:checked]:border-gold-500 has-[:checked]:bg-gold-50">
            <input
              type="radio"
              name="receiptMode"
              value="now"
              checked={receiptMode === "now"}
              onChange={() => setReceiptMode("now")}
              className="mt-1 h-4 w-4 accent-gold-500"
            />
            <div>
              <p className="text-sm font-medium text-navy-700">Sí, lo tengo ahora</p>
              <p className="text-xs text-navy-400">
                Subí el comprobante. La orden pasa directo a revisión del admin.
              </p>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-navy-200 p-3 transition-all has-[:checked]:border-gold-500 has-[:checked]:bg-gold-50">
            <input
              type="radio"
              name="receiptMode"
              value="preventa"
              checked={receiptMode === "preventa"}
              onChange={() => setReceiptMode("preventa")}
              className="mt-1 h-4 w-4 accent-gold-500"
            />
            <div>
              <p className="text-sm font-medium text-navy-700">Preventa (sin comprobante)</p>
              <p className="text-xs text-navy-400">
                El comprador recibe un email con los datos de transferencia. Subís el comprobante después.
              </p>
            </div>
          </label>
        </div>

        {/* Receipt upload (only if mode = now) */}
        {receiptMode === "now" && (
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
        )}

        {/* Preventa info */}
        {receiptMode === "preventa" && (
          <div className="card border-amber-200 bg-amber-50/40">
            <p className="text-sm font-semibold text-amber-800">
              📨 Se enviará un email al comprador con:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-amber-700">
              <li>Datos para la transferencia (titular, CBU, alias)</li>
              <li>Total a transferir</li>
              <li>Tu nombre y email para que te envíe el comprobante</li>
            </ul>
            <p className="mt-3 text-xs text-amber-700">
              Cuando recibas el comprobante, lo cargás desde tu lista de órdenes y la orden pasa a revisión del admin.
            </p>
          </div>
        )}

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
          disabled={(receiptMode === "now" && !receipt) || submitting}
          onClick={submit}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
              Enviando...
            </span>
          ) : receiptMode === "preventa" ? (
            "Crear preventa y enviar datos"
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
      <h2 className="mb-1 text-xl font-bold text-navy-700">
        {receiptMode === "preventa" ? "Preventa creada" : "Orden enviada"}
      </h2>
      <p className="mb-6 text-sm text-navy-400">
        {receiptMode === "preventa"
          ? `Le enviamos un email a ${buyerEmail} con los datos de transferencia. Cuando recibas el comprobante, cargalo desde tu lista de órdenes.`
          : "El administrador va a revisar el comprobante. Cuando se apruebe, el comprador recibirá las entradas por email."}
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
            setReceiptMode("now");
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
