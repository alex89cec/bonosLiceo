"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useAvailableTickets } from "@/hooks/useAvailableTickets";
import { useReservation } from "@/hooks/useReservation";

type Step = "email" | "select" | "confirm" | "success";

export default function PublicReservationPage() {
  const params = useParams<{ slug: string; code: string }>();
  const campaignSlug = params.slug;
  const sellerCode = params.code;

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    tickets,
    availableCount,
    loading: ticketsLoading,
    error: ticketsError,
    refetch,
  } = useAvailableTickets(campaignSlug);
  const {
    reserve,
    loading: reserving,
    error: reserveError,
    reservation,
  } = useReservation();

  // Filter tickets by search
  const filteredTickets = useMemo(() => {
    if (!searchQuery) return tickets;
    return tickets.filter((t) => t.number.includes(searchQuery));
  }, [tickets, searchQuery]);

  // Email step
  if (step === "email") {
    return (
      <main className="flex min-h-screen flex-col bg-gray-50">
        {/* Header */}
        <div className="relative bg-navy-700 px-4 pb-6 pt-5">
          <div className="absolute left-0 right-0 top-0 h-1.5 bg-gold-500" />
          <div className="mx-auto max-w-md">
            <Image
              src="/logo.png"
              alt="CEC Liceo Militar"
              width={140}
              height={37}
              className="mb-3 drop-shadow"
            />
            <h1 className="text-xl font-bold text-white">Reserva tu bono</h1>
            <p className="text-sm text-navy-200">
              Completa tus datos para comenzar
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md px-4 py-6">
          <div className="card space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-navy-700"
              >
                Correo electronico *
              </label>
              <input
                id="email"
                type="email"
                className="input-field"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
              />
            </div>

            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-semibold text-navy-700"
              >
                Nombre (opcional)
              </label>
              <input
                id="name"
                type="text"
                className="input-field"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-1.5 block text-sm font-semibold text-navy-700"
              >
                Telefono (opcional)
              </label>
              <input
                id="phone"
                type="tel"
                className="input-field"
                placeholder="+54 11 1234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                inputMode="tel"
              />
            </div>

            <button
              className="btn-gold w-full"
              disabled={!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
              onClick={() => setStep("select")}
            >
              Continuar
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Select ticket step
  if (step === "select") {
    return (
      <main className="flex min-h-screen flex-col bg-gray-50">
        <div className="relative bg-navy-700 px-4 pb-5 pt-5">
          <div className="absolute left-0 right-0 top-0 h-1.5 bg-gold-500" />
          <div className="mx-auto max-w-md">
            <button
              className="mb-2 inline-flex items-center gap-1 text-sm text-navy-200 hover:text-white"
              onClick={() => setStep("email")}
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
              Atras
            </button>
            <h1 className="text-xl font-bold text-white">Elige tu numero</h1>
            <p className="text-sm text-navy-200">
              {availableCount} números disponibles
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md px-4 py-4">
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

          {/* Loading state */}
          {ticketsLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-200 border-t-gold-500" />
            </div>
          )}

          {/* Error state */}
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
              No se encontraron numeros
            </p>
          )}

          {/* Continue button */}
          <div className="sticky bottom-0 bg-gray-50 pb-4 pt-2">
            <button
              className="btn-gold w-full"
              disabled={!selectedNumber}
              onClick={() => setStep("confirm")}
            >
              {selectedNumber
                ? `Reservar #${selectedNumber}`
                : "Selecciona un numero"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Confirm step
  if (step === "confirm") {
    return (
      <main className="flex min-h-screen flex-col bg-gray-50">
        <div className="relative bg-navy-700 px-4 pb-5 pt-5">
          <div className="absolute left-0 right-0 top-0 h-1.5 bg-gold-500" />
          <div className="mx-auto max-w-md">
            <button
              className="mb-2 inline-flex items-center gap-1 text-sm text-navy-200 hover:text-white"
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
            <h1 className="text-xl font-bold text-white">Confirmar reserva</h1>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md px-4 py-6">
          {/* Summary card */}
          <div className="mb-4 overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm">
            <div className="bg-navy-700 px-5 py-4 text-center">
              <p className="text-xs text-navy-300">Tu numero</p>
              <p className="font-mono text-3xl font-bold text-gold-400">
                #{selectedNumber}
              </p>
            </div>
            <div className="divide-y divide-navy-50 px-5">
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-navy-400">Email</span>
                <span className="text-sm font-medium text-navy-700">
                  {email}
                </span>
              </div>
              {name && (
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-navy-400">Nombre</span>
                  <span className="text-sm font-medium text-navy-700">
                    {name}
                  </span>
                </div>
              )}
            </div>
          </div>

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
                campaignSlug,
                sellerCode,
                buyerEmail: email,
                ticketNumber: selectedNumber!,
                buyerName: name || undefined,
                buyerPhone: phone || undefined,
              });
              if (result) setStep("success");
            }}
          >
            {reserving ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
                Reservando...
              </span>
            ) : (
              "Confirmar reserva"
            )}
          </button>
        </div>
      </main>
    );
  }

  // Success step
  return (
    <main className="flex min-h-screen flex-col bg-gray-50">
      <div className="relative bg-navy-700 px-4 pb-8 pt-5">
        <div className="absolute left-0 right-0 top-0 h-1.5 bg-gold-500" />
        <div className="mx-auto max-w-md text-center">
          <Image
            src="/logo.png"
            alt="CEC Liceo Militar"
            width={120}
            height={31}
            className="mx-auto mb-4 drop-shadow"
          />
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gold-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-navy-900"
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
          <h1 className="text-2xl font-bold text-white">Reserva confirmada</h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md px-4 py-6">
        {reservation && (
          <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm">
            <div className="bg-navy-700 px-5 py-4 text-center">
              <p className="text-xs text-navy-300">Tu numero</p>
              <p className="font-mono text-4xl font-bold text-gold-400">
                #{reservation.ticket_number}
              </p>
              <p className="mt-1 text-sm text-navy-200">
                {reservation.campaign_name}
              </p>
            </div>

            <div className="divide-y divide-navy-50 px-5">
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-navy-400">Monto</span>
                <span className="text-lg font-bold text-navy-700">
                  ${reservation.ticket_price}
                </span>
              </div>
            </div>

            <div className="mx-5 mb-4 mt-2 rounded-xl bg-gold-50 p-4">
              <p className="text-sm font-semibold text-gold-800">
                Tu reserva fue registrada. El vendedor te contactara para
                coordinar el pago.
              </p>
              <p className="mt-1 text-xs text-gold-600">
                Se envio la informacion a {reservation.buyer_email}
              </p>
            </div>

            <div className="px-5 pb-4">
              <p className="text-center text-xs text-navy-300">
                ID: {reservation.reservation_id}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
