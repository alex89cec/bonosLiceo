"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

interface ScannableEvent {
  id: string;
  name: string;
  slug: string;
  event_date: string;
  venue: string | null;
  status: string;
}

interface ScanResultData {
  result: "valid" | "already_used" | "invalid" | "wrong_event" | "cancelled";
  ticket?: {
    buyer_name: string | null;
    buyer_email?: string | null;
    type_name: string;
    type_color?: string | null;
    parent_bundle_name: string | null;
    entered_at?: string | null;
    entered_by_name?: string | null;
    actual_event_name?: string | null;
    status?: string;
  };
  mode?: string;
}

export default function ScannerPage() {
  const [events, setEvents] = useState<ScannableEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);

  // Camera + scan state
  const [scannerReady, setScannerReady] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResultData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastScannedRef = useRef<{ token: string; ts: number } | null>(null);
  const containerId = "scanner-container";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrRef = useRef<any>(null);

  // Load events on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/scanner/events");
        const json = await res.json();
        if (!res.ok) {
          setEventsError(json.error || "Error al cargar eventos");
          setEventsLoading(false);
          return;
        }
        const list: ScannableEvent[] = json.events || [];
        setEvents(list);
        if (list.length === 1) setSelectedEventId(list[0].id);
        setEventsLoading(false);
      } catch {
        setEventsError("Error de red");
        setEventsLoading(false);
      }
    })();
  }, []);

  // Submit a scan
  const submitScan = useCallback(
    async (token: string) => {
      if (!selectedEventId || submitting) return;
      // De-dup: ignore same token within 3 seconds
      const now = Date.now();
      const last = lastScannedRef.current;
      if (last && last.token === token && now - last.ts < 3000) return;
      lastScannedRef.current = { token, ts: now };

      setSubmitting(true);
      try {
        const res = await fetch("/api/scanner/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            event_id: selectedEventId,
            mode: testMode ? "test" : "real",
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setResult({
            result: "invalid",
            ticket: undefined,
          });
        } else {
          setResult(json);
          // Audio + vibration feedback
          if (json.result === "valid") {
            playBeep("success");
            navigator.vibrate?.([100]);
          } else {
            playBeep("error");
            navigator.vibrate?.([200, 100, 200]);
          }
        }
      } catch {
        setResult({ result: "invalid" });
        playBeep("error");
      }
      setSubmitting(false);
    },
    [selectedEventId, testMode, submitting],
  );

  // Init html5-qrcode when an event is selected
  useEffect(() => {
    if (!selectedEventId) return;
    let scanner: unknown = null;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled) return;
        const Html5Qrcode = mod.Html5Qrcode;
        const instance = new Html5Qrcode(containerId);
        html5QrRef.current = instance;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await instance.start(
          { facingMode: "environment" },
          config,
          (decoded: string) => {
            // Decoded text — submit
            submitScan(decoded);
          },
          () => {
            // ignore decode failures (continuous scan)
          },
        );
        scanner = instance;
        setScannerReady(true);
      } catch (err) {
        console.error("Scanner init error:", err);
        setScannerError(
          err instanceof Error
            ? err.message
            : "No se pudo iniciar la cámara",
        );
      }
    })();

    return () => {
      cancelled = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inst = scanner as any;
      if (inst && typeof inst.stop === "function") {
        try {
          inst.stop().catch(() => {});
        } catch {}
      }
      html5QrRef.current = null;
      setScannerReady(false);
    };
  }, [selectedEventId, submitScan]);

  // Auto-clear result after 3 seconds
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 3500);
    return () => clearTimeout(t);
  }, [result]);

  if (eventsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-200 border-t-gold-500" />
      </div>
    );
  }

  if (eventsError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="text-red-300">{eventsError}</p>
          <Link href="/seller/dashboard" className="btn-secondary mt-4 inline-block">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <h2 className="mb-2 text-xl font-bold">Sin eventos para escanear</h2>
          <p className="text-sm text-navy-300">
            No estás asignado como escáner en ningún evento. Pedile a un admin
            que te active <code className="font-mono">can_scan</code>.
          </p>
          <Link href="/seller/dashboard" className="btn-secondary mt-4 inline-block">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  // Event picker
  if (!selectedEventId) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <header className="text-center">
          <h1 className="text-2xl font-bold">Scanner</h1>
          <p className="text-sm text-navy-300">Elegí el evento</p>
        </header>
        <div className="space-y-2">
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedEventId(e.id)}
              className="w-full rounded-2xl border border-navy-700 bg-navy-800 p-4 text-left transition-colors hover:border-gold-400 hover:bg-navy-700"
            >
              <p className="font-semibold">{e.name}</p>
              <p className="mt-1 text-xs text-navy-300">
                {new Date(e.event_date).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
                {e.venue && <span> • {e.venue}</span>}
              </p>
              {e.status === "past" && (
                <span className="mt-2 inline-block rounded-full bg-gray-600 px-2 py-0.5 text-[10px] font-semibold uppercase">
                  Pasado
                </span>
              )}
            </button>
          ))}
        </div>
        <Link
          href="/seller/dashboard"
          className="block text-center text-sm text-navy-400 hover:text-white"
        >
          ← Volver al inicio
        </Link>
      </div>
    );
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-navy-700 bg-navy-800 px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <button
            onClick={() => {
              if (events.length > 1) setSelectedEventId(null);
            }}
            className="flex items-center gap-1 text-sm text-navy-300 hover:text-white"
            disabled={events.length === 1}
          >
            {events.length > 1 ? (
              <>
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
                Cambiar evento
              </>
            ) : (
              <span className="text-navy-500">{selectedEvent?.name}</span>
            )}
          </button>
          <Link href="/seller/dashboard" className="text-xs text-navy-300 hover:text-white">
            Salir
          </Link>
        </div>
        {events.length > 1 && (
          <p className="mx-auto mt-1 max-w-md truncate text-xs text-navy-300">
            {selectedEvent?.name}
          </p>
        )}
      </header>

      {/* Test mode toggle */}
      <div
        className={`px-4 py-2 transition-colors ${
          testMode ? "bg-amber-500 text-amber-950" : "bg-navy-800 text-navy-300"
        }`}
      >
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
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
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            {testMode ? (
              <span className="font-bold">MODO TEST — los scans no marcan como usadas</span>
            ) : (
              <span>Modo real (las entradas se marcan como usadas)</span>
            )}
          </div>
          <label className="inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
              className="sr-only"
            />
            <span
              className={`relative h-5 w-9 rounded-full transition-colors ${
                testMode ? "bg-amber-700" : "bg-navy-600"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  testMode ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </span>
          </label>
        </div>
      </div>

      {/* Camera viewport */}
      <div className="relative flex-1 bg-black">
        <div
          id={containerId}
          className="mx-auto h-full max-w-md [&_video]:!w-full [&_video]:!h-auto"
        />
        {!scannerReady && !scannerError && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-navy-300">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-200/30 border-t-gold-400" />
          </div>
        )}
        {scannerError && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div>
              <p className="font-semibold text-red-300">Error de cámara</p>
              <p className="mt-1 text-xs text-navy-300">{scannerError}</p>
              <p className="mt-3 text-xs text-navy-400">
                Verificá que diste permiso de cámara y que estés en HTTPS.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Result overlay */}
      {result && <ResultOverlay result={result} testMode={testMode} />}
    </div>
  );
}

function ResultOverlay({
  result,
  testMode,
}: {
  result: ScanResultData;
  testMode: boolean;
}) {
  const cfg = STATUS_CONFIG[result.result];
  const t = result.ticket;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md rounded-t-3xl ${cfg.bg} ${cfg.text} shadow-2xl`}
    >
      <div className="px-6 py-5 text-center">
        <div className="mb-2 text-4xl">{cfg.emoji}</div>
        <h2 className="text-xl font-bold">{cfg.title}</h2>
        {testMode && result.result === "valid" && (
          <p className="mt-1 text-xs font-medium opacity-80">
            (test — no se marcó como usada)
          </p>
        )}

        {t && (
          <div className="mt-4 space-y-1 text-sm">
            {t.buyer_name && (
              <p className="font-semibold">{t.buyer_name}</p>
            )}
            <p>
              {t.type_name}
              {t.parent_bundle_name && (
                <span className="ml-1 text-xs opacity-80">
                  · 📦 {t.parent_bundle_name}
                </span>
              )}
            </p>
            {result.result === "already_used" && t.entered_at && (
              <p className="mt-2 text-xs opacity-80">
                Ingresó:{" "}
                {new Date(t.entered_at).toLocaleString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {t.entered_by_name && <span> · {t.entered_by_name}</span>}
              </p>
            )}
            {result.result === "wrong_event" && t.actual_event_name && (
              <p className="mt-2 text-xs opacity-80">
                Esta entrada es para: <strong>{t.actual_event_name}</strong>
              </p>
            )}
            {result.result === "cancelled" && t.status && (
              <p className="mt-2 text-xs opacity-80">
                Estado: <strong>{t.status}</strong>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_CONFIG: Record<
  string,
  { emoji: string; title: string; bg: string; text: string }
> = {
  valid: {
    emoji: "✅",
    title: "VÁLIDA",
    bg: "bg-green-500",
    text: "text-white",
  },
  already_used: {
    emoji: "⚠️",
    title: "YA USADA",
    bg: "bg-yellow-400",
    text: "text-yellow-950",
  },
  invalid: {
    emoji: "❌",
    title: "INVÁLIDA",
    bg: "bg-red-500",
    text: "text-white",
  },
  wrong_event: {
    emoji: "🚫",
    title: "OTRO EVENTO",
    bg: "bg-orange-500",
    text: "text-white",
  },
  cancelled: {
    emoji: "❌",
    title: "CANCELADA / REEMBOLSADA",
    bg: "bg-red-500",
    text: "text-white",
  },
};

// Audio feedback (Web Audio API — no asset files needed)
function playBeep(kind: "success" | "error") {
  try {
    const Ctx = typeof window !== "undefined"
      ? (window.AudioContext ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext)
      : null;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (kind === "success") {
      // Single short beep at higher pitch
      makeTone(ctx, 800, 0.15, 0.3);
    } else {
      // Two beeps at lower pitch
      makeTone(ctx, 300, 0.15, 0.3);
      setTimeout(() => makeTone(ctx, 300, 0.15, 0.3), 200);
    }
  } catch {
    // ignore audio errors
  }
}

function makeTone(
  ctx: AudioContext,
  freq: number,
  duration: number,
  volume: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}
