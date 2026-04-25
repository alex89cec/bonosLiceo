"use client";

import { useState } from "react";

interface Props {
  eventName: string;
  eventSlug: string;
  sellerCode: string;
  className?: string;
}

/**
 * Button that opens a popover with a sharable ticket purchase link
 * pre-attributed to the seller (?seller=<code>).
 *
 * Provides:
 * - URL display
 * - Copy to clipboard
 * - WhatsApp share
 * - Native Web Share (when available)
 */
export default function ShareEventButton({
  eventName,
  eventSlug,
  sellerCode,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/tickets/${eventSlug}?seller=${encodeURIComponent(sellerCode)}`
      : `/tickets/${eventSlug}?seller=${encodeURIComponent(sellerCode)}`;

  const message = `🎟️ Comprá tus entradas para ${eventName}:\n${url}`;

  function copy() {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function nativeShare() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: eventName,
          text: `Comprá tus entradas para ${eventName}`,
          url,
        });
      } catch {
        // user cancelled
      }
    } else {
      // fallback to copy
      copy();
    }
  }

  function whatsapp() {
    const wa = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(wa, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1 rounded-full border border-navy-200 bg-white px-2.5 py-1 text-xs font-semibold text-navy-600 transition hover:border-gold-400 hover:bg-gold-50 ${className}`}
        title="Compartir link de venta"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
        Compartir
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-navy-700">Compartir link</h3>
                <p className="text-sm text-navy-400">{eventName}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="-mt-1 -mr-1 rounded-full p-1 text-navy-400 hover:bg-navy-50"
                aria-label="Cerrar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="mb-2 text-xs font-semibold text-navy-500">
              Cualquier compra desde este link queda asignada a vos:
            </p>
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-navy-50 p-3">
              <span className="flex-1 break-all text-xs text-navy-700">{url}</span>
              <button
                onClick={copy}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  copied
                    ? "bg-green-200 text-green-800"
                    : "bg-navy-700 text-white hover:bg-navy-800"
                }`}
              >
                {copied ? "✓ Copiado" : "Copiar"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={whatsapp}
                className="flex items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
                </svg>
                WhatsApp
              </button>
              <button
                onClick={nativeShare}
                className="flex items-center justify-center gap-2 rounded-xl bg-navy-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-navy-800"
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
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                Compartir
              </button>
            </div>

            <p className="mt-4 text-center text-[11px] text-navy-400">
              Tu código:{" "}
              <span className="font-mono font-bold text-navy-700">{sellerCode}</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
