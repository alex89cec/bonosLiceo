"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";
import { useAvailableTickets } from "@/hooks/useAvailableTickets";
import { useReservation } from "@/hooks/useReservation";
import type { PaymentMode } from "@/types/database";

type Step = "select" | "buyer" | "confirm" | "success";

interface CampaignInfo {
  id: string;
  name: string;
  slug: string;
  ticket_price: number;
  installments_enabled: boolean;
  installments_count: number;
}

export default function SellerSellPage() {
  const { slug } = useParams<{ slug: string }>();

  const [sellerCode, setSellerCode] = useState<string>("");
  const [campaignInfo, setCampaignInfo] = useState<CampaignInfo | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [maxTickets, setMaxTickets] = useState<number | null>(null);
  const [soldCount, setSoldCount] = useState(0);

  const [step, setStep] = useState<Step>("select");
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [paymentMode, setPaymentMode] =
    useState<PaymentMode>("full_payment");
  const [origin, setOrigin] = useState("");

  const {
    tickets,
    availableCount,
    loading: ticketsLoading,
    error: ticketsError,
    refetch,
  } = useAvailableTickets(slug);
  const {
    reserve,
    reserveBatch,
    loading: reserving,
    error: reserveError,
    reservation,
    batchResults,
    batchErrors,
  } = useReservation();

  // Set origin for QR code URL
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Fetch seller profile and campaign info on mount
  useEffect(() => {
    async function init() {
      const supabase = createClient();

      // Get seller profile
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setInitError("No autenticado");
        setInitLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("seller_code, role")
        .eq("id", user.id)
        .single();

      if (!profile) {
        setInitError("Perfil no encontrado");
        setInitLoading(false);
        return;
      }

      // If admin without seller_code, auto-generate one
      if (!profile.seller_code && profile.role === "admin") {
        const autoCode = "ADM-" + user.id.substring(0, 6).toUpperCase();
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ seller_code: autoCode })
          .eq("id", user.id);

        if (updateError) {
          setInitError("Error al generar código de vendedor");
          setInitLoading(false);
          return;
        }
        setSellerCode(autoCode);
      } else if (!profile.seller_code) {
        setInitError("Perfil de vendedor no encontrado");
        setInitLoading(false);
        return;
      } else {
        setSellerCode(profile.seller_code);
      }

      // Get campaign info
      const { data: campaign } = await supabase
        .from("campaigns")
        .select(
          "id, name, slug, ticket_price, installments_enabled, installments_count",
        )
        .eq("slug", slug)
        .single();

      if (!campaign) {
        setInitError("Campaña no encontrada");
        setInitLoading(false);
        return;
      }

      setCampaignInfo(campaign as CampaignInfo);

      // Get seller quota for this campaign
      const { data: assignment } = await supabase
        .from("campaign_sellers")
        .select("max_tickets")
        .eq("seller_id", user.id)
        .eq("campaign_id", campaign.id)
        .single();

      if (assignment?.max_tickets) {
        setMaxTickets(assignment.max_tickets);
      }

      // Count seller's current reservations for this campaign
      const { count } = await supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user.id)
        .eq("campaign_id", campaign.id)
        .in("status", ["active", "confirmed"]);

      setSoldCount(count || 0);
      setInitLoading(false);
    }

    init();
  }, [slug]);

  const filteredTickets = useMemo(() => {
    if (!searchQuery) return tickets;
    return tickets.filter((t) => t.number.includes(searchQuery));
  }, [tickets, searchQuery]);

  const remainingQuota =
    maxTickets !== null ? maxTickets - soldCount : Infinity;
  const canSelectMore = selectedNumbers.length < remainingQuota;

  function toggleNumber(number: string) {
    setSelectedNumbers((prev) =>
      prev.includes(number)
        ? prev.filter((n) => n !== number)
        : canSelectMore
          ? [...prev, number]
          : prev,
    );
  }

  // Loading state
  if (initLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-200 border-t-gold-500" />
      </div>
    );
  }

  // Error state
  if (initError) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-red-600">{initError}</p>
        <Link href="/seller/dashboard" className="btn-secondary mt-4">
          Volver al panel
        </Link>
      </div>
    );
  }

  // Step 1: Select numbers
  if (step === "select") {
    return (
      <div>
        <Link
          href="/seller/dashboard"
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Volver
        </Link>

        <div className="mb-4">
          <h2 className="text-xl font-bold text-navy-700">
            {campaignInfo?.name}
          </h2>
          <p className="text-sm text-navy-400">
            Selecciona números para vender •{" "}
            <span className="font-semibold text-gold-600">
              ${campaignInfo?.ticket_price} c/u
            </span>
          </p>
        </div>

        {/* Seller quota */}
        {maxTickets !== null && (
          <div
            className={`mb-4 rounded-xl px-3 py-2 text-sm ${
              soldCount >= maxTickets
                ? "bg-red-50 text-red-700"
                : "bg-navy-50 text-navy-600"
            }`}
          >
            Cuota:{" "}
            <span className="font-bold">{soldCount}</span> /{" "}
            <span className="font-bold">{maxTickets}</span> vendidos
            {soldCount >= maxTickets && (
              <span className="ml-2 font-semibold">— Límite alcanzado</span>
            )}
          </div>
        )}

        {/* Selection info */}
        {selectedNumbers.length > 0 && (
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-gold-100 px-3 py-1 text-sm font-semibold text-gold-800">
              {selectedNumbers.length} seleccionado
              {selectedNumbers.length !== 1 ? "s" : ""}
            </span>
            {selectedNumbers.length > 1 && (
              <span className="text-xs text-navy-400">
                Total: $
                {(campaignInfo?.ticket_price || 0) * selectedNumbers.length}
              </span>
            )}
            <button
              className="ml-auto text-sm text-navy-400 hover:text-red-500"
              onClick={() => setSelectedNumbers([])}
            >
              Limpiar
            </button>
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            className="input-field"
            placeholder="Buscar número... (ej: 00123)"
            value={searchQuery}
            onChange={(e) =>
              setSearchQuery(e.target.value.replace(/\D/g, ""))
            }
            inputMode="numeric"
            maxLength={5}
          />
        </div>

        <p className="mb-2 text-xs text-navy-400">
          {availableCount} disponibles de {tickets.length} números
        </p>

        {/* Loading */}
        {ticketsLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-200 border-t-gold-500" />
          </div>
        )}

        {/* Error */}
        {ticketsError && (
          <div className="card border-red-200 bg-red-50 text-center">
            <p className="text-sm text-red-600">{ticketsError}</p>
            <button className="btn-secondary mt-2" onClick={refetch}>
              Reintentar
            </button>
          </div>
        )}

        {/* Ticket grid */}
        {!ticketsLoading && !ticketsError && (
          <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {filteredTickets.slice(0, 100).map((ticket) => {
              const isTaken = ticket.status !== "available";
              const isSelected = selectedNumbers.includes(ticket.number);
              return (
                <button
                  key={ticket.number}
                  className={`ticket-number relative ${isSelected ? "selected" : ""} ${isTaken ? "taken" : ""}`}
                  onClick={() => !isTaken && toggleNumber(ticket.number)}
                  disabled={isTaken}
                >
                  {ticket.number}
                  {isSelected && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold-500 text-[10px] font-bold text-white shadow-sm">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {filteredTickets.length > 100 && (
          <p className="mb-4 text-center text-sm text-navy-400">
            Mostrando 100 de {filteredTickets.length}. Usa el buscador.
          </p>
        )}

        {filteredTickets.length === 0 && !ticketsLoading && (
          <p className="py-8 text-center text-navy-400">
            No se encontraron numeros disponibles
          </p>
        )}

        {/* Continue */}
        <div className="sticky bottom-0 bg-gray-50 pb-4 pt-2">
          <button
            className="btn-gold w-full"
            disabled={
              selectedNumbers.length === 0 ||
              (maxTickets !== null && soldCount >= maxTickets)
            }
            onClick={() => setStep("buyer")}
          >
            {maxTickets !== null && soldCount >= maxTickets
              ? "Límite de ventas alcanzado"
              : selectedNumbers.length > 0
                ? `Vender ${selectedNumbers.length} número${selectedNumbers.length !== 1 ? "s" : ""}`
                : "Selecciona números"}
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Buyer info
  if (step === "buyer") {
    return (
      <div>
        <button
          className="mb-3 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
          onClick={() => setStep("select")}
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
          Cambiar selección
        </button>

        <div className="mb-4">
          <h2 className="text-xl font-bold text-navy-700">
            Datos del comprador
          </h2>
          <p className="text-sm text-navy-400">
            {selectedNumbers.length} número
            {selectedNumbers.length !== 1 ? "s" : ""} seleccionado
            {selectedNumbers.length !== 1 ? "s" : ""}:{" "}
            <span className="font-mono font-bold text-gold-600">
              {selectedNumbers.map((n) => `#${n}`).join(", ")}
            </span>
          </p>
        </div>

        <div className="card space-y-4">
          <div>
            <label
              htmlFor="buyerEmail"
              className="mb-1.5 block text-sm font-semibold text-navy-700"
            >
              Correo electronico del comprador *
            </label>
            <input
              id="buyerEmail"
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
            <label
              htmlFor="buyerName"
              className="mb-1.5 block text-sm font-semibold text-navy-700"
            >
              Nombre{" "}
              <span className="font-normal text-navy-300">(opcional)</span>
            </label>
            <input
              id="buyerName"
              type="text"
              className="input-field"
              placeholder="Nombre del comprador"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div>
            <label
              htmlFor="buyerPhone"
              className="mb-1.5 block text-sm font-semibold text-navy-700"
            >
              Telefono{" "}
              <span className="font-normal text-navy-300">(opcional)</span>
            </label>
            <input
              id="buyerPhone"
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

        <div className="mt-4">
          <button
            className="btn-gold w-full"
            disabled={
              !buyerEmail ||
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)
            }
            onClick={() => setStep("confirm")}
          >
            Continuar
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Confirm
  if (step === "confirm") {
    const totalAmount =
      (campaignInfo?.ticket_price || 0) * selectedNumbers.length;

    return (
      <div>
        <button
          className="mb-3 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
          onClick={() => setStep("buyer")}
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
          Editar datos
        </button>

        <h2 className="mb-4 text-xl font-bold text-navy-700">
          Confirmar venta
        </h2>

        {/* Summary */}
        <div className="mb-4 overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm">
          <div className="bg-navy-700 px-5 py-4 text-center">
            <p className="text-xs text-navy-300">
              {selectedNumbers.length} Número
              {selectedNumbers.length !== 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap justify-center gap-2 py-2">
              {selectedNumbers.map((n) => (
                <span
                  key={n}
                  className="font-mono text-lg font-bold text-gold-400"
                >
                  #{n}
                </span>
              ))}
            </div>
          </div>
          <div className="divide-y divide-navy-50 px-5">
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-navy-400">Comprador</span>
              <span className="text-sm font-medium text-navy-700">
                {buyerEmail}
              </span>
            </div>
            {buyerName && (
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-navy-400">Nombre</span>
                <span className="text-sm font-medium text-navy-700">
                  {buyerName}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-navy-400">Monto total</span>
              <span className="text-lg font-bold text-navy-700">
                ${totalAmount}
                {selectedNumbers.length > 1 && (
                  <span className="ml-1 text-xs font-normal text-navy-400">
                    ({selectedNumbers.length} × ${campaignInfo?.ticket_price})
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Payment mode (only if installments enabled) */}
        {campaignInfo?.installments_enabled && (
          <div className="card mb-4 space-y-3">
            <p className="text-sm font-semibold text-navy-700">
              Modo de pago
            </p>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-navy-200 p-3 transition-all has-[:checked]:border-gold-500 has-[:checked]:bg-gold-50">
              <input
                type="radio"
                name="payment"
                value="full_payment"
                checked={paymentMode === "full_payment"}
                onChange={() => setPaymentMode("full_payment")}
                className="h-5 w-5 accent-gold-500"
              />
              <span className="text-sm font-medium text-navy-700">
                Pago completo
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-navy-200 p-3 transition-all has-[:checked]:border-gold-500 has-[:checked]:bg-gold-50">
              <input
                type="radio"
                name="payment"
                value="installments"
                checked={paymentMode === "installments"}
                onChange={() => setPaymentMode("installments")}
                className="h-5 w-5 accent-gold-500"
              />
              <span className="text-sm font-medium text-navy-700">
                {campaignInfo.installments_count} cuotas
              </span>
            </label>
          </div>
        )}

        {reserveError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-600">{reserveError}</p>
          </div>
        )}

        <button
          className="btn-gold w-full"
          disabled={reserving}
          onClick={async () => {
            const pm = campaignInfo?.installments_enabled
              ? paymentMode
              : "full_payment";

            if (selectedNumbers.length === 1) {
              // Single ticket — use original endpoint
              const result = await reserve({
                campaignSlug: slug,
                sellerCode,
                buyerEmail,
                ticketNumber: selectedNumbers[0],
                paymentMode: pm,
                buyerName: buyerName || undefined,
                buyerPhone: buyerPhone || undefined,
              });
              if (result) setStep("success");
            } else {
              // Multiple tickets — use batch endpoint
              const { results } = await reserveBatch({
                campaignSlug: slug,
                sellerCode,
                buyerEmail,
                ticketNumbers: selectedNumbers,
                paymentMode: pm,
                buyerName: buyerName || undefined,
                buyerPhone: buyerPhone || undefined,
              });
              if (results.length > 0) setStep("success");
            }
          }}
        >
          {reserving ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
              Procesando...
            </span>
          ) : (
            "Confirmar venta"
          )}
        </button>
      </div>
    );
  }

  // Success
  const successResults =
    batchResults.length > 0
      ? batchResults
      : reservation
        ? [reservation]
        : [];

  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <h2 className="mb-1 text-xl font-bold text-navy-700">
        {successResults.length === 1
          ? "Venta registrada"
          : `${successResults.length} ventas registradas`}
      </h2>
      <p className="mb-6 text-sm text-navy-400">
        {successResults.length === 1
          ? "El bono fue asignado correctamente"
          : "Los bonos fueron asignados correctamente"}
      </p>

      {/* Partial failure warning */}
      {batchErrors.length > 0 && (
        <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-left">
          <p className="mb-2 text-sm font-semibold text-yellow-800">
            {batchErrors.length} número
            {batchErrors.length !== 1 ? "s" : ""} no se pudieron reservar:
          </p>
          {batchErrors.map((e) => (
            <p key={e.ticket_number} className="text-sm text-yellow-700">
              #{e.ticket_number}: {e.error}
            </p>
          ))}
        </div>
      )}

      {successResults.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-navy-100 bg-white text-left shadow-sm">
          {/* Ticket numbers header */}
          <div className="bg-navy-700 px-5 py-4 text-center">
            <p className="text-xs text-navy-300">
              {successResults.length === 1
                ? "Número"
                : `${successResults.length} Números`}
            </p>
            <div className="flex flex-wrap justify-center gap-3 py-2">
              {successResults.map((r) => (
                <span
                  key={r.reservation_id}
                  className="font-mono text-2xl font-bold text-gold-400"
                >
                  #{r.ticket_number}
                </span>
              ))}
            </div>
            <p className="mt-1 text-sm text-navy-200">
              {successResults[0].campaign_name}
            </p>
          </div>

          {/* Details */}
          <div className="divide-y divide-navy-50 px-5">
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-navy-400">Comprador</span>
              <span className="text-sm font-medium text-navy-700">
                {successResults[0].buyer_email}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-navy-400">Modo</span>
              <span className="text-sm font-medium text-navy-700">
                {successResults[0].payment_mode === "full_payment"
                  ? "Pago completo"
                  : `${successResults[0].installments_count} cuotas`}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-navy-400">Monto total</span>
              <span className="text-lg font-bold text-navy-700">
                $
                {successResults.reduce(
                  (sum, r) => sum + r.ticket_price,
                  0,
                )}
              </span>
            </div>
          </div>

          {/* Reservation code for single ticket */}
          {successResults.length === 1 && (
            <div className="border-t border-navy-100 px-5 py-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-navy-400">
                Código de reserva
              </p>
              <p className="mt-1 select-all break-all font-mono text-sm font-bold text-navy-700">
                {successResults[0].reservation_id}
              </p>
            </div>
          )}

          {/* QR Code */}
          {origin && (
            <div className="border-t border-navy-100 px-5 py-4 text-center">
              <p className="mb-2 text-xs font-medium text-navy-400">
                QR para consultar{" "}
                {successResults.length === 1 ? "reserva" : "reservas"}
              </p>
              <div className="inline-block rounded-xl bg-white p-3 shadow-sm">
                <QRCodeSVG
                  value={
                    successResults.length === 1
                      ? `${origin}/mis-numeros?email=${encodeURIComponent(successResults[0].buyer_email)}&id=${encodeURIComponent(successResults[0].reservation_id)}`
                      : `${origin}/mis-numeros?email=${encodeURIComponent(successResults[0].buyer_email)}`
                  }
                  size={160}
                  level="M"
                />
              </div>
              <p className="mt-2 text-xs text-navy-300">
                El comprador puede escanear para ver{" "}
                {successResults.length === 1
                  ? "su reserva"
                  : "sus reservas"}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          className="btn-secondary flex-1"
          onClick={() => {
            setStep("select");
            setSelectedNumbers([]);
            setBuyerEmail("");
            setBuyerName("");
            setBuyerPhone("");
            setPaymentMode("full_payment");
            refetch();
          }}
        >
          Vender otro
        </button>
        <Link
          href="/seller/dashboard"
          className="btn-primary flex-1 text-center"
        >
          Volver al panel
        </Link>
      </div>
    </div>
  );
}
