"use client";

import { useState, useRef, useEffect } from "react";

export interface SellerOption {
  id: string;
  full_name: string;
  email: string;
  seller_code: string | null;
  role: "admin" | "seller";
}

interface Props {
  /** Current seller assigned (display) */
  currentSellerId: string | null;
  currentSellerName: string | null;
  currentSellerCode: string | null;
  /** All available sellers (already loaded by parent) */
  sellers: SellerOption[];
  /** Endpoint to PATCH the seller. Body: { seller_id: string | null } */
  endpoint: string;
  disabled?: boolean;
  /** Called after a successful save with the new seller (or null) */
  onSaved?: (seller: SellerOption | null) => void;
}

export default function SellerPickerCell({
  currentSellerId,
  currentSellerName,
  currentSellerCode,
  sellers,
  endpoint,
  disabled,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  async function assign(sellerId: string | null) {
    if (saving) return;
    if (sellerId === currentSellerId) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seller_id: sellerId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al guardar");
        setSaving(false);
        return;
      }
      const seller = sellerId ? sellers.find((s) => s.id === sellerId) : null;
      onSaved?.(seller || null);
      setOpen(false);
      setSearch("");
    } catch {
      setError("Error de red");
    }
    setSaving(false);
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? sellers.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.seller_code && s.seller_code.toLowerCase().includes(q)),
      )
    : sellers;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`group flex w-full items-center gap-1 text-left ${
          disabled ? "cursor-default" : "cursor-pointer"
        }`}
      >
        <div className="min-w-0 flex-1">
          {currentSellerName ? (
            <>
              <p className="truncate text-xs font-medium text-navy-700">
                {currentSellerName}
              </p>
              {currentSellerCode && (
                <p className="font-mono text-[10px] text-navy-400">
                  {currentSellerCode}
                </p>
              )}
            </>
          ) : (
            <span className="text-xs italic text-navy-300">Sin vendedor</span>
          )}
        </div>
        {!disabled && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3 shrink-0 text-navy-400 opacity-0 transition-opacity group-hover:opacity-100"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-navy-200 bg-white p-2 shadow-xl">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                setSearch("");
              }
            }}
            placeholder="Buscar nombre, código o email..."
            className="mb-2 w-full rounded-lg border border-navy-200 px-2 py-1.5 text-xs outline-none focus:border-gold-500"
          />

          <div className="max-h-64 overflow-y-auto">
            {/* Clear option */}
            {currentSellerId && (
              <button
                type="button"
                onClick={() => assign(null)}
                disabled={saving}
                className="mb-1 flex w-full items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-left text-xs text-red-700 hover:bg-red-100"
              >
                ✕ Quitar vendedor (sin atribución)
              </button>
            )}

            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-navy-400">
                Sin resultados
              </p>
            ) : (
              filtered.map((s) => {
                const isCurrent = s.id === currentSellerId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => assign(s.id)}
                    disabled={saving || isCurrent}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                      isCurrent
                        ? "bg-gold-100 text-navy-700"
                        : "hover:bg-navy-50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-navy-700">
                        {s.full_name}
                        {s.role === "admin" && (
                          <span className="ml-1 rounded-full bg-gold-200 px-1.5 py-0 text-[9px] font-bold text-navy-800">
                            ADMIN
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[10px] text-navy-400">
                        {s.email}
                      </p>
                    </div>
                    {s.seller_code && (
                      <span className="shrink-0 rounded bg-navy-50 px-1.5 py-0.5 font-mono text-[10px] text-navy-600">
                        {s.seller_code}
                      </span>
                    )}
                    {isCurrent && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 shrink-0 text-green-600"
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
                    )}
                  </button>
                );
              })
            )}
          </div>

          {error && (
            <p className="mt-2 rounded-lg bg-red-50 p-1.5 text-[10px] text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
