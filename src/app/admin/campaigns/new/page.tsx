"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pad5(n: number): string {
  return String(n).padStart(5, "0");
}

export default function NewCampaignPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ticketPrice, setTicketPrice] = useState("1000");
  const [numberFrom, setNumberFrom] = useState("0");
  const [numberTo, setNumberTo] = useState("9999");
  const [maxTicketsPerBuyer, setMaxTicketsPerBuyer] = useState("1");
  const [installmentsEnabled, setInstallmentsEnabled] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState("3");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rangeSize =
    Math.max(0, parseInt(numberTo || "0") - parseInt(numberFrom || "0") + 1);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugManual) {
      setSlug(slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlugManual(true);
    setSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .replace(/--+/g, "-"),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let startISO: string;
    let endISO: string;
    try {
      startISO = new Date(startDate).toISOString();
      endISO = new Date(endDate).toISOString();
    } catch {
      setError("Fechas inválidas. Selecciona fechas válidas de inicio y fin.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug,
          description: description.trim() || undefined,
          start_date: startISO,
          end_date: endISO,
          ticket_price: parseFloat(ticketPrice),
          number_from: parseInt(numberFrom, 10),
          number_to: parseInt(numberTo, 10),
          max_tickets_per_buyer: parseInt(maxTicketsPerBuyer, 10),
          installments_enabled: installmentsEnabled,
          installments_count: installmentsEnabled
            ? parseInt(installmentsCount, 10)
            : 1,
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        setError(
          `Error del servidor (${res.status}). La creación puede tardar unos segundos — vuelve al listado y verifica.`,
        );
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || `Error al crear la campaña (${res.status})`);
        setLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch (err) {
      console.error("Campaign creation error:", err);
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin"
          className="mb-2 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
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
          Volver a campañas
        </Link>
        <h2 className="text-xl font-bold text-navy-700">Nueva Campaña</h2>
        <p className="text-sm text-navy-400">
          Completa los datos para crear una nueva campaña de bonos
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name & Slug */}
        <div className="card space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
            Información básica
          </h3>

          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-sm font-semibold text-navy-700"
            >
              Nombre de la campaña
            </label>
            <input
              id="name"
              type="text"
              className="input-field"
              placeholder="ej: Bono Navideño 2025"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              maxLength={200}
            />
          </div>

          <div>
            <label
              htmlFor="slug"
              className="mb-1.5 block text-sm font-semibold text-navy-700"
            >
              Slug (URL)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-navy-400">/c/</span>
              <input
                id="slug"
                type="text"
                className="input-field font-mono"
                placeholder="bono-navideno-2025"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                required
                maxLength={100}
                pattern="^[a-z0-9-]+$"
              />
            </div>
            <p className="mt-1 text-xs text-navy-400">
              Solo letras minúsculas, números y guiones
            </p>
          </div>

          <div>
            <label
              htmlFor="description"
              className="mb-1.5 block text-sm font-semibold text-navy-700"
            >
              Descripción{" "}
              <span className="font-normal text-navy-300">(opcional)</span>
            </label>
            <textarea
              id="description"
              className="input-field min-h-[80px] resize-y"
              placeholder="Descripción de la campaña..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Dates */}
        <div className="card space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
            Fechas
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="startDate"
                className="mb-1.5 block text-sm font-semibold text-navy-700"
              >
                Fecha de inicio
              </label>
              <input
                id="startDate"
                type="datetime-local"
                className="input-field"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                htmlFor="endDate"
                className="mb-1.5 block text-sm font-semibold text-navy-700"
              >
                Fecha de fin
              </label>
              <input
                id="endDate"
                type="datetime-local"
                className="input-field"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Number Range */}
        <div className="card space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
            Rango de números
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="numberFrom"
                className="mb-1.5 block text-sm font-semibold text-navy-700"
              >
                Número desde
              </label>
              <input
                id="numberFrom"
                type="number"
                className="input-field font-mono"
                value={numberFrom}
                onChange={(e) => setNumberFrom(e.target.value)}
                required
                min="0"
                max="99999"
                step="1"
                inputMode="numeric"
              />
              <p className="mt-1 text-xs text-navy-400">
                {pad5(parseInt(numberFrom || "0"))}
              </p>
            </div>

            <div>
              <label
                htmlFor="numberTo"
                className="mb-1.5 block text-sm font-semibold text-navy-700"
              >
                Número hasta
              </label>
              <input
                id="numberTo"
                type="number"
                className="input-field font-mono"
                value={numberTo}
                onChange={(e) => setNumberTo(e.target.value)}
                required
                min="1"
                max="99999"
                step="1"
                inputMode="numeric"
              />
              <p className="mt-1 text-xs text-navy-400">
                {pad5(parseInt(numberTo || "0"))}
              </p>
            </div>
          </div>

          <p className="rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-600">
            Se generarán{" "}
            <span className="font-bold">{rangeSize.toLocaleString()}</span>{" "}
            bonos ({pad5(parseInt(numberFrom || "0"))} –{" "}
            {pad5(parseInt(numberTo || "0"))})
          </p>
          {rangeSize > 100000 && (
            <p className="text-xs font-medium text-red-600">
              Máximo 100,000 números por campaña
            </p>
          )}
        </div>

        {/* Pricing & Limits */}
        <div className="card space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
            Precio y límites
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ticketPrice"
                className="mb-1.5 block text-sm font-semibold text-navy-700"
              >
                Precio del bono ($)
              </label>
              <input
                id="ticketPrice"
                type="number"
                className="input-field"
                value={ticketPrice}
                onChange={(e) => setTicketPrice(e.target.value)}
                required
                min="0.01"
                step="0.01"
                inputMode="decimal"
              />
            </div>

            <div>
              <label
                htmlFor="maxTickets"
                className="mb-1.5 block text-sm font-semibold text-navy-700"
              >
                Max bonos por comprador
              </label>
              <input
                id="maxTickets"
                type="number"
                className="input-field"
                value={maxTicketsPerBuyer}
                onChange={(e) => setMaxTicketsPerBuyer(e.target.value)}
                required
                min="1"
                step="1"
                inputMode="numeric"
              />
            </div>
          </div>
        </div>

        {/* Installments */}
        <div className="card space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
            Cuotas
          </h3>

          <label className="flex cursor-pointer items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-navy-700">
                Permitir pago en cuotas
              </p>
              <p className="text-xs text-navy-400">
                Los vendedores podrán elegir venta en cuotas
              </p>
            </div>
            <span className="toggle-slider">
              <input
                className="sr-only"
                type="checkbox"
                checked={installmentsEnabled}
                onChange={(e) => setInstallmentsEnabled(e.target.checked)}
              />
              <span className="slider" />
            </span>
          </label>

          {installmentsEnabled && (
            <div>
              <label
                htmlFor="installmentsCount"
                className="mb-1.5 block text-sm font-semibold text-navy-700"
              >
                Cantidad de cuotas
              </label>
              <input
                id="installmentsCount"
                type="number"
                className="input-field"
                value={installmentsCount}
                onChange={(e) => setInstallmentsCount(e.target.value)}
                required
                min="2"
                max="12"
                step="1"
                inputMode="numeric"
              />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Link href="/admin" className="btn-secondary flex-1 text-center">
            Cancelar
          </Link>
          <button
            type="submit"
            className="btn-gold flex-1 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              loading ||
              !name ||
              !slug ||
              !startDate ||
              !endDate ||
              !ticketPrice ||
              rangeSize > 100000 ||
              rangeSize < 1
            }
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
                Creando...
              </span>
            ) : (
              "Crear campaña"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
