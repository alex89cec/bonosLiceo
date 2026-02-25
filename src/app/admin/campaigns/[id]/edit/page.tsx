"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import type { Campaign, CampaignStatus, Winner } from "@/types/database";

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

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function EditCampaignPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  // Loading / error states
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [editable, setEditable] = useState(true);
  const [takenCount, setTakenCount] = useState(0);

  // Form fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(true);
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ticketPrice, setTicketPrice] = useState("");
  const [numberFrom, setNumberFrom] = useState("0");
  const [numberTo, setNumberTo] = useState("9999");
  const [maxTicketsPerBuyer, setMaxTicketsPerBuyer] = useState("1");
  const [installmentsEnabled, setInstallmentsEnabled] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState("3");
  const [status, setStatus] = useState<CampaignStatus>("draft");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sorteo state
  const [sorteoMode, setSorteoMode] = useState<"random" | "manual">("random");
  const [manualNumber, setManualNumber] = useState("");
  const [randomCount, setRandomCount] = useState("1");
  const [winners, setWinners] = useState<Winner[]>([]);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [sorteoLoading, setSorteoLoading] = useState(false);
  const [sorteoError, setSorteoError] = useState<string | null>(null);
  const [sorteoSuccess, setSorteoSuccess] = useState<string | null>(null);
  const [closeLoading, setCloseLoading] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const rangeSize =
    Math.max(0, parseInt(numberTo || "0") - parseInt(numberFrom || "0") + 1);

  // Fetch campaign data
  useEffect(() => {
    async function fetchCampaign() {
      try {
        const res = await fetch(`/api/campaigns/${id}`);
        const data = await res.json();

        if (!res.ok) {
          setPageError(data.error || "Error al cargar la campaña");
          setPageLoading(false);
          return;
        }

        const c: Campaign = data.campaign;
        setEditable(data.editable);
        setTakenCount(data.taken_count);

        setName(c.name);
        setSlug(c.slug);
        setDescription(c.description || "");
        setStartDate(toLocalDatetime(c.start_date));
        setEndDate(toLocalDatetime(c.end_date));
        setTicketPrice(String(c.ticket_price));
        setNumberFrom(String(c.number_from));
        setNumberTo(String(c.number_to));
        setMaxTicketsPerBuyer(String(c.max_tickets_per_buyer));
        setInstallmentsEnabled(c.installments_enabled);
        setInstallmentsCount(String(c.installments_count));
        setStatus(c.status);

        setPageLoading(false);
      } catch {
        setPageError("Error de conexión al cargar la campaña");
        setPageLoading(false);
      }
    }

    fetchCampaign();
  }, [id]);

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

    const startISO = new Date(startDate).toISOString();
    const endISO = new Date(endDate).toISOString();

    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PUT",
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
          status,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al actualizar la campaña");
        setLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  }

  // Fetch sorteo data when campaign is not editable
  useEffect(() => {
    if (!editable && !pageLoading) {
      fetchWinners();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, pageLoading]);

  async function fetchWinners() {
    try {
      const res = await fetch(`/api/campaigns/${id}/sorteo`);
      const data = await res.json();
      if (res.ok) {
        setWinners(data.winners || []);
        setEligibleCount(data.eligible_count ?? 0);
        if (data.campaign_status) {
          setStatus(data.campaign_status);
        }
      }
    } catch {
      // Silent fail — winners just won't load
    }
  }

  async function handleSorteo() {
    setSorteoLoading(true);
    setSorteoError(null);
    setSorteoSuccess(null);

    const body =
      sorteoMode === "random"
        ? { mode: "random" as const, count: parseInt(randomCount) }
        : { mode: "manual" as const, ticket_number: manualNumber.padStart(5, "0") };

    try {
      const res = await fetch(`/api/campaigns/${id}/sorteo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setSorteoError(data.error || "Error al realizar el sorteo");
      } else {
        if (sorteoMode === "random") {
          const drawn = data.drawn ?? 0;
          setSorteoSuccess(
            `Se sortearon ${drawn} ganador${drawn !== 1 ? "es" : ""}` +
              (data.warning ? `. ${data.warning}` : ""),
          );
        } else {
          setSorteoSuccess(`Boleto ${manualNumber.padStart(5, "0")} agregado como ganador`);
        }
        setManualNumber("");
        await fetchWinners();
      }
    } catch {
      setSorteoError("Error de conexión");
    }
    setSorteoLoading(false);
  }

  async function handleCloseCampaign() {
    setCloseLoading(true);
    setSorteoError(null);
    try {
      const res = await fetch(`/api/campaigns/${id}/close`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("closed");
        setShowCloseConfirm(false);
      } else {
        setSorteoError(data.error || "Error al cerrar la campaña");
      }
    } catch {
      setSorteoError("Error de conexión");
    }
    setCloseLoading(false);
  }

  function positionLabel(pos: number): string {
    if (pos === 1) return "1er Premio";
    if (pos === 2) return "2do Premio";
    if (pos === 3) return "3er Premio";
    return `${pos}to Premio`;
  }

  // Loading state
  if (pageLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-200 border-t-gold-500" />
      </div>
    );
  }

  // Error state
  if (pageError) {
    return (
      <div>
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
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
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
          {pageError}
        </div>
      </div>
    );
  }

  // Not editable — show read-only view
  if (!editable) {
    return (
      <div>
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
          <h2 className="text-xl font-bold text-navy-700">{name}</h2>
          <p className="text-sm text-navy-400">/{slug}</p>
        </div>

        {/* Lock message */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Campaña bloqueada para edición
            </p>
            <p className="mt-1 text-sm text-amber-700">
              Esta campaña tiene{" "}
              <span className="font-bold">{takenCount}</span> número
              {takenCount !== 1 ? "s" : ""} reservado
              {takenCount !== 1 ? "s" : ""} o vendido
              {takenCount !== 1 ? "s" : ""}. No es posible editarla.
            </p>
          </div>
        </div>

        {/* Read-only campaign details */}
        <div className="space-y-4">
          <div className="card space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
              Información
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-navy-400">Estado</span>
                <p className="font-semibold capitalize">{status}</p>
              </div>
              <div>
                <span className="text-navy-400">Precio</span>
                <p className="font-semibold">${ticketPrice}</p>
              </div>
              <div>
                <span className="text-navy-400">Rango</span>
                <p className="font-mono font-semibold">
                  {pad5(parseInt(numberFrom))}–{pad5(parseInt(numberTo))}
                </p>
              </div>
              <div>
                <span className="text-navy-400">Total números</span>
                <p className="font-semibold">{rangeSize.toLocaleString()}</p>
              </div>
              {installmentsEnabled && (
                <div>
                  <span className="text-navy-400">Cuotas</span>
                  <p className="font-semibold">{installmentsCount}</p>
                </div>
              )}
              <div>
                <span className="text-navy-400">Max por comprador</span>
                <p className="font-semibold">{maxTicketsPerBuyer}</p>
              </div>
            </div>
          </div>

          <div className="card space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
              Fechas
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-navy-400">Inicio</span>
                <p className="font-semibold">
                  {new Date(startDate).toLocaleDateString("es")}
                </p>
              </div>
              <div>
                <span className="text-navy-400">Fin</span>
                <p className="font-semibold">
                  {new Date(endDate).toLocaleDateString("es")}
                </p>
              </div>
            </div>
          </div>

          {description && (
            <div className="card">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
                Descripción
              </h3>
              <p className="text-sm text-navy-600">{description}</p>
            </div>
          )}

          {/* ─── SORTEO SECTION ─── */}

          {/* Draw controls — only when campaign is active */}
          {status === "active" && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
                  Sorteo
                </h3>
                <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-medium text-navy-500">
                  {eligibleCount} boleto{eligibleCount !== 1 ? "s" : ""} elegible{eligibleCount !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Mode tabs */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSorteoMode("random")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    sorteoMode === "random"
                      ? "bg-gold-100 text-gold-700 ring-2 ring-gold-400"
                      : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                  }`}
                >
                  Aleatorio
                </button>
                <button
                  type="button"
                  onClick={() => setSorteoMode("manual")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    sorteoMode === "manual"
                      ? "bg-gold-100 text-gold-700 ring-2 ring-gold-400"
                      : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                  }`}
                >
                  Manual
                </button>
              </div>

              {/* Random mode */}
              {sorteoMode === "random" && (
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label
                      htmlFor="randomCount"
                      className="mb-1.5 block text-sm font-semibold text-navy-700"
                    >
                      Cantidad de ganadores
                    </label>
                    <input
                      id="randomCount"
                      type="number"
                      className="input-field"
                      value={randomCount}
                      onChange={(e) => setRandomCount(e.target.value)}
                      min="1"
                      max={Math.max(eligibleCount, 1)}
                      step="1"
                      inputMode="numeric"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-gold whitespace-nowrap"
                    disabled={sorteoLoading || eligibleCount === 0 || parseInt(randomCount) < 1}
                    onClick={handleSorteo}
                  >
                    {sorteoLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
                        Sorteando...
                      </span>
                    ) : (
                      "🎲 Sortear"
                    )}
                  </button>
                </div>
              )}

              {/* Manual mode */}
              {sorteoMode === "manual" && (
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label
                      htmlFor="manualNumber"
                      className="mb-1.5 block text-sm font-semibold text-navy-700"
                    >
                      Número de boleto ganador
                    </label>
                    <input
                      id="manualNumber"
                      type="text"
                      className="input-field font-mono"
                      placeholder="00000"
                      value={manualNumber}
                      onChange={(e) => setManualNumber(e.target.value.replace(/\D/g, "").slice(0, 5))}
                      maxLength={5}
                      inputMode="numeric"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-gold whitespace-nowrap"
                    disabled={sorteoLoading || manualNumber.length === 0}
                    onClick={handleSorteo}
                  >
                    {sorteoLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
                        Agregando...
                      </span>
                    ) : (
                      "Agregar ganador"
                    )}
                  </button>
                </div>
              )}

              {/* Error / Success messages */}
              {sorteoError && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
                  {sorteoError}
                </div>
              )}
              {sorteoSuccess && (
                <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
                  {sorteoSuccess}
                </div>
              )}
            </div>
          )}

          {/* Winners list — shown when there are winners (active or closed) */}
          {winners.length > 0 && (
            <div className="card space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
                Ganadores ({winners.length})
              </h3>
              <div className="space-y-2">
                {winners.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-xl border border-gold-200 bg-gold-50 p-3"
                  >
                    <div>
                      <span className="text-xs font-medium text-gold-600">
                        {positionLabel(w.position)}
                      </span>
                      <p className="font-mono text-lg font-bold text-navy-700">
                        {w.ticket_number}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold text-navy-700">
                        {w.buyer_name || "Sin nombre"}
                      </p>
                      <p className="text-navy-400">{w.buyer_email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Close campaign button — only when active and has winners */}
          {status === "active" && winners.length > 0 && (
            <div className="card space-y-3 border-red-200">
              {!showCloseConfirm ? (
                <button
                  type="button"
                  className="w-full rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                  onClick={() => setShowCloseConfirm(true)}
                >
                  Cerrar campaña
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-red-700">
                    Esta acción es irreversible. Se cerrará la campaña con{" "}
                    <span className="font-bold">{winners.length}</span> ganador
                    {winners.length !== 1 ? "es" : ""}.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary flex-1"
                      onClick={() => setShowCloseConfirm(false)}
                      disabled={closeLoading}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                      onClick={handleCloseCampaign}
                      disabled={closeLoading}
                    >
                      {closeLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Cerrando...
                        </span>
                      ) : (
                        "Confirmar cierre"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Closed campaign badge */}
          {status === "closed" && (
            <div className="flex items-center gap-2 rounded-xl bg-gray-100 p-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-500"
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
              <p className="text-sm font-semibold text-gray-600">
                Campaña cerrada
              </p>
            </div>
          )}
        </div>

        <div className="mt-6">
          <Link href="/admin" className="btn-secondary inline-block text-center">
            Volver a campañas
          </Link>
        </div>
      </div>
    );
  }

  // Editable form
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
        <h2 className="text-xl font-bold text-navy-700">Editar Campaña</h2>
        <p className="text-sm text-navy-400">
          Modifica los datos de la campaña
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Status */}
        <div className="card space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
            Estado
          </h3>
          <div className="flex gap-2">
            {(["draft", "active", "closed"] as CampaignStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  status === s
                    ? s === "active"
                      ? "bg-green-100 text-green-700 ring-2 ring-green-400"
                      : s === "draft"
                        ? "bg-yellow-100 text-yellow-700 ring-2 ring-yellow-400"
                        : "bg-gray-100 text-gray-700 ring-2 ring-gray-400"
                    : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                }`}
              >
                {s === "draft"
                  ? "Borrador"
                  : s === "active"
                    ? "Activa"
                    : "Cerrada"}
              </button>
            ))}
          </div>
        </div>

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
                placeholder="1000"
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
            className="btn-gold flex-1"
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
                Guardando...
              </span>
            ) : (
              "Guardar cambios"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
