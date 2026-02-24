"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAvailableTickets } from "@/hooks/useAvailableTickets";
import { useReservation } from "@/hooks/useReservation";
import type { PaymentMode } from "@/types/database";

type Step = "select" | "buyer" | "confirm" | "success";

interface CampaignInfo {
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

  const [step, setStep] = useState<Step>("select");
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [paymentMode, setPaymentMode] =
    useState<PaymentMode>("full_payment");

  const { tickets, availableCount, loading: ticketsLoading, error: ticketsError, refetch } =
    useAvailableTickets(slug);
  const {
    reserve,
    loading: reserving,
    error: reserveError,
    reservation,
  } = useReservation();

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
        .select("seller_code")
        .eq("id", user.id)
        .single();

      if (!profile?.seller_code) {
        setInitError("Perfil de vendedor no encontrado");
        setInitLoading(false);
        return;
      }

      setSellerCode(profile.seller_code);

      // Get campaign info
      const { data: campaign } = await supabase
        .from("campaigns")
        .select(
          "name, slug, ticket_price, installments_enabled, installments_count",
        )
        .eq("slug", slug)
        .single();

      if (!campaign) {
        setInitError("Campaña no encontrada");
        setInitLoading(false);
        return;
      }

      setCampaignInfo(campaign as CampaignInfo);
      setInitLoading(false);
    }

    init();
  }, [slug]);

  const filteredTickets = useMemo(() => {
    if (!searchQuery) return tickets;
    return tickets.filter((t) => t.number.includes(searchQuery));
  }, [tickets, searchQuery]);

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

  // Step 1: Select number
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
            Selecciona un numero para vender •{" "}
            <span className="font-semibold text-gold-600">
              ${campaignInfo?.ticket_price}
            </span>
          </p>
        </div>

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
              return (
                <button
                  key={ticket.number}
                  className={`ticket-number ${selectedNumber === ticket.number ? "selected" : ""} ${isTaken ? "taken" : ""}`}
                  onClick={() => !isTaken && setSelectedNumber(ticket.number)}
                  disabled={isTaken}
                >
                  {ticket.number}
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
            disabled={!selectedNumber}
            onClick={() => setStep("buyer")}
          >
            {selectedNumber
              ? `Vender #${selectedNumber}`
              : "Selecciona un numero"}
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
          Cambiar numero
        </button>

        <div className="mb-4">
          <h2 className="text-xl font-bold text-navy-700">
            Datos del comprador
          </h2>
          <p className="text-sm text-navy-400">
            Numero seleccionado:{" "}
            <span className="font-mono font-bold text-gold-600">
              #{selectedNumber}
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
            <p className="text-xs text-navy-300">Numero</p>
            <p className="font-mono text-3xl font-bold text-gold-400">
              #{selectedNumber}
            </p>
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
              <span className="text-sm text-navy-400">Monto</span>
              <span className="text-lg font-bold text-navy-700">
                ${campaignInfo?.ticket_price}
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
            const result = await reserve({
              campaignSlug: slug,
              sellerCode,
              buyerEmail,
              ticketNumber: selectedNumber!,
              paymentMode: campaignInfo?.installments_enabled
                ? paymentMode
                : "full_payment",
              buyerName: buyerName || undefined,
              buyerPhone: buyerPhone || undefined,
            });
            if (result) setStep("success");
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
        Venta registrada
      </h2>
      <p className="mb-6 text-sm text-navy-400">
        El bono fue asignado correctamente
      </p>

      {reservation && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-navy-100 bg-white text-left shadow-sm">
          <div className="bg-navy-700 px-5 py-4 text-center">
            <p className="text-xs text-navy-300">Numero</p>
            <p className="font-mono text-4xl font-bold text-gold-400">
              #{reservation.ticket_number}
            </p>
            <p className="mt-1 text-sm text-navy-200">
              {reservation.campaign_name}
            </p>
          </div>

          <div className="divide-y divide-navy-50 px-5">
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-navy-400">Comprador</span>
              <span className="text-sm font-medium text-navy-700">
                {reservation.buyer_email}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-navy-400">Modo</span>
              <span className="text-sm font-medium text-navy-700">
                {reservation.payment_mode === "full_payment"
                  ? "Pago completo"
                  : `${reservation.installments_count} cuotas`}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-navy-400">Monto</span>
              <span className="text-lg font-bold text-navy-700">
                ${reservation.ticket_price}
              </span>
            </div>
          </div>

          <div className="px-5 pb-4 pt-2">
            <p className="text-center text-xs text-navy-300">
              ID: {reservation.reservation_id}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          className="btn-secondary flex-1"
          onClick={() => {
            setStep("select");
            setSelectedNumber(null);
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
