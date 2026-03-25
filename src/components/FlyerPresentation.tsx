"use client";

import { useEffect } from "react";

interface FlyerPresentationProps {
  campaignName: string;
  flyerUrl: string | null;
  description: string | null;
  ticketPrice: number;
  onClose: () => void;
}

export default function FlyerPresentation({
  campaignName,
  flyerUrl,
  description,
  ticketPrice,
  onClose,
}: FlyerPresentationProps) {
  // Prevent body scroll when overlay is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-navy-900">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold text-white">
            {campaignName}
          </h2>
          <p className="text-sm font-semibold text-gold-400">
            ${ticketPrice} c/u
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Cerrar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {/* Flyer image */}
        {flyerUrl && (
          <div className="mb-4">
            <img
              src={flyerUrl}
              alt={`Flyer de ${campaignName}`}
              className="w-full rounded-2xl object-contain"
              style={{ touchAction: "pinch-zoom" }}
              loading="eager"
            />
          </div>
        )}

        {/* Description */}
        {description && (
          <div className="rounded-2xl bg-white/10 p-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gold-400">
              Descripción
            </h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
              {description}
            </p>
          </div>
        )}

        {/* No content fallback */}
        {!flyerUrl && !description && (
          <div className="flex flex-1 items-center justify-center py-20">
            <p className="text-sm text-white/50">
              Esta campaña no tiene flyer ni descripción
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
