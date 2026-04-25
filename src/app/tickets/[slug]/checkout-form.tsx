"use client";

import { useState } from "react";
import type { Event, EventTicketType } from "@/types/database";
import { formatCurrency } from "@/lib/format";

type Step = "select" | "buyer" | "transfer" | "success";

interface InitialSeller {
  code: string;
  name: string;
}

interface Props {
  event: Event;
  /** Types visible for sale (filtered: no cortesía, no bundle-only) */
  ticketTypes: EventTicketType[];
  /** All types for the event (used to resolve bundle component names) */
  allTypes: EventTicketType[];
  stockMap: Record<string, number | null>;
  initialSeller: InitialSeller | null;
}

export default function PublicCheckout({
  event,
  ticketTypes,
  allTypes,
  stockMap,
  initialSeller,
}: Props) {
  const [step, setStep] = useState<Step>("select");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [sellerCode, setSellerCode] = useState(initialSeller?.code || "");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const totalQty = Object.values(quantities).reduce((s, q) => s + q, 0);
  const totalAmount = Object.entries(quantities).reduce((sum, [tid, qty]) => {
    const t = ticketTypes.find((x) => x.id === tid);
    return sum + (t ? Number(t.price) * qty : 0);
  }, 0);

  const hasTransferData = Boolean(
    event.transfer_holder_name ||
      event.transfer_cbu ||
      event.transfer_alias ||
      event.transfer_bank,
  );

  function setQty(typeId: string, q: number) {
    const stock = stockMap[typeId];
    const max = stock === null ? 50 : stock ?? 0;
    const clamped = Math.max(0, Math.min(q, max));
    setQuantities((prev) => {
      const next = { ...prev };
      if (clamped === 0) delete next[typeId];
      else next[typeId] = clamped;
      return next;
    });
  }

  async function submit() {
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
        is_preventa: false,
        seller_code: sellerCode.trim() || null,
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

  // Step 1 — Select types & quantities
  if (step === "select") {
    return (
      <div className="mt-4">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
          Tipos de entrada
        </h3>

        {ticketTypes.length === 0 ? (
          <p className="rounded-2xl border border-navy-100 bg-white p-8 text-center text-sm text-navy-400">
            No hay tipos de entrada disponibles.
          </p>
        ) : (
          <div className="space-y-2">
            {ticketTypes.map((t) => {
              const qty = quantities[t.id] || 0;
              const stock = stockMap[t.id];
              const isUnlimited = stock === null;
              const remaining = isUnlimited ? 50 : stock ?? 0;
              const soldOut = !isUnlimited && remaining === 0 && qty === 0;
              const isBundle = t.bundle_items && t.bundle_items.length > 0;
              const bundleSummary = isBundle
                ? t
                    .bundle_items!.map((bi) => {
                      const comp = allTypes.find((x) => x.id === bi.ticket_type_id);
                      return `${bi.quantity} ${comp?.name || "?"}`;
                    })
                    .join(" + ")
                : null;

              return (
                <div
                  key={t.id}
                  className={`rounded-2xl border bg-white p-4 shadow-sm ${
                    soldOut ? "border-gray-200 opacity-60" : isBundle ? "border-purple-200 ring-1 ring-purple-100" : "border-navy-100"
                  }`}
                >
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
                        <p className="mt-0.5 text-xs font-medium text-purple-700">
                          Incluye: {bundleSummary}
                        </p>
                      )}
                      <p className="mt-1 text-sm">
                        <span className="font-bold text-gold-600">
                          {formatCurrency(t.price)}
                        </span>
                        {!isUnlimited && (
                          <span className="ml-2 text-xs text-navy-400">
                            {soldOut ? "Agotado" : `${remaining} disponibles`}
                          </span>
                        )}
                      </p>
                    </div>
                    {!soldOut && (
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
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalQty > 0 && (
          <div className="sticky bottom-4 mt-4">
            <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-md">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-navy-400">Total</span>
                <span className="text-xl font-bold text-navy-700">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
              <button
                className="w-full rounded-xl bg-gold-500 py-3 text-sm font-bold text-navy-800 transition hover:bg-gold-400"
                onClick={() => setStep("buyer")}
              >
                Continuar ({totalQty} {totalQty === 1 ? "entrada" : "entradas"})
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Step 2 — Buyer info
  if (step === "buyer") {
    return (
      <div className="mt-4">
        <button
          onClick={() => setStep("select")}
          className="mb-3 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Cambiar selección
        </button>

        <h3 className="mb-1 text-lg font-bold text-navy-700">Tus datos</h3>
        <p className="mb-4 text-sm text-navy-400">
          Vamos a usar este email para enviarte las entradas.
        </p>

        {/* Seller attribution */}
        {initialSeller ? (
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-700">
              👤 Tu compra queda asociada al vendedor:
            </p>
            <p className="text-sm font-semibold text-blue-900">{initialSeller.name}</p>
          </div>
        ) : null}

        <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-navy-700"
              >
                Email *
              </label>
              <input
                id="email"
                type="email"
                className="input-field"
                placeholder="tu@email.com"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
              />
            </div>

            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-semibold text-navy-700"
              >
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
              <label
                htmlFor="phone"
                className="mb-1.5 block text-sm font-semibold text-navy-700"
              >
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

            {/* Manual seller code (only if not pre-attributed) */}
            {!initialSeller && (
              <div>
                <label
                  htmlFor="sellerCode"
                  className="mb-1.5 block text-sm font-semibold text-navy-700"
                >
                  Código de vendedor{" "}
                  <span className="font-normal text-navy-300">(opcional)</span>
                </label>
                <input
                  id="sellerCode"
                  type="text"
                  className="input-field font-mono uppercase"
                  placeholder="Ej: ABC1234"
                  value={sellerCode}
                  onChange={(e) => setSellerCode(e.target.value.trim().toUpperCase())}
                  maxLength={40}
                />
                <p className="mt-1 text-xs text-navy-400">
                  Si te derivó alguien con un código, ingresalo acá para que la compra le quede asignada.
                </p>
              </div>
            )}
          </div>
        </div>

        <button
          className="mt-4 w-full rounded-xl bg-gold-500 py-3 text-sm font-bold text-navy-800 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={
            !buyerEmail ||
            !buyerName ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)
          }
          onClick={() => setStep("transfer")}
        >
          Continuar
        </button>
      </div>
    );
  }

  // Step 3 — Transfer instructions + receipt upload
  if (step === "transfer") {
    return (
      <div className="mt-4">
        <button
          onClick={() => setStep("buyer")}
          className="mb-3 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>

        <h3 className="mb-1 text-lg font-bold text-navy-700">Datos para transferencia</h3>
        <p className="mb-4 text-sm text-navy-400">
          Hacé la transferencia y subí el comprobante para confirmar tu compra.
        </p>

        {/* Total card */}
        <div className="mb-4 rounded-2xl border-2 border-gold-500 bg-gold-50 p-4">
          <p className="text-xs uppercase tracking-wider text-gold-700">
            Total a transferir
          </p>
          <p className="text-3xl font-bold text-navy-700">
            {formatCurrency(totalAmount)}
          </p>
          <div className="mt-2 space-y-0.5 text-xs text-navy-500">
            {Object.entries(quantities).map(([tid, qty]) => {
              const t = ticketTypes.find((x) => x.id === tid);
              if (!t) return null;
              return (
                <div key={tid}>
                  {qty}× {t.name} — {formatCurrency(Number(t.price) * qty)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Transfer data */}
        {hasTransferData ? (
          <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="mb-3 text-sm font-bold text-amber-800">💸 Datos bancarios</p>
            <div className="space-y-2 text-sm">
              {event.transfer_holder_name && (
                <DataRow label="Titular" value={event.transfer_holder_name} />
              )}
              {event.transfer_bank && (
                <DataRow label="Banco" value={event.transfer_bank} />
              )}
              {event.transfer_cbu && (
                <DataRow label="CBU" value={event.transfer_cbu} mono copyable />
              )}
              {event.transfer_alias && (
                <DataRow label="Alias" value={event.transfer_alias} mono copyable />
              )}
              {event.transfer_id_number && (
                <DataRow label="CUIT/DNI" value={event.transfer_id_number} mono />
              )}
            </div>
            {event.transfer_instructions && (
              <p className="mt-3 border-t border-amber-200 pt-3 text-xs text-amber-700">
                {event.transfer_instructions}
              </p>
            )}
          </div>
        ) : (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">
              Este evento aún no tiene los datos de transferencia configurados. Por favor
              contactá al organizador.
            </p>
          </div>
        )}

        {/* Receipt upload */}
        <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-navy-700">Subí el comprobante *</p>
          <p className="mb-3 text-xs text-navy-400">
            PDF, JPG, PNG o WEBP — máximo 5MB
          </p>
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

        {submitError && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
            {submitError}
          </div>
        )}

        <button
          className="mt-4 w-full rounded-xl bg-gold-500 py-3 text-sm font-bold text-navy-800 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!receipt || submitting || !hasTransferData}
          onClick={submit}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
              Enviando...
            </span>
          ) : (
            "Enviar y confirmar pago"
          )}
        </button>
      </div>
    );
  }

  // Success
  return (
    <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="mb-1 text-xl font-bold text-green-800">¡Listo!</h3>
      <p className="mb-1 text-sm text-green-700">
        Recibimos tu compra y el comprobante.
      </p>
      <p className="text-xs text-green-600">
        Vamos a revisar el pago y enviarte las entradas a <strong>{buyerEmail}</strong>.
      </p>
    </div>
  );
}

function DataRow({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-amber-700">{label}</span>
      <span className="flex items-center gap-2">
        <span
          className={`text-right font-bold text-navy-800 ${mono ? "font-mono text-sm" : "text-sm"}`}
        >
          {value}
        </span>
        {copyable && (
          <button
            onClick={copy}
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
              copied
                ? "bg-green-200 text-green-800"
                : "bg-amber-200 text-amber-800 hover:bg-amber-300"
            }`}
            type="button"
            title="Copiar"
          >
            {copied ? "✓" : "Copiar"}
          </button>
        )}
      </span>
    </div>
  );
}
