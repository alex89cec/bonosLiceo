"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  email: string;
  endpoint: string; // e.g. /api/admin/reservations/<id>/buyer-email
  /** Disabled — non-admin users won't see the edit button */
  disabled?: boolean;
  /** Called with the new email after a successful save */
  onSaved?: (newEmail: string) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EditableEmailCell({
  email,
  endpoint,
  disabled,
  onSaved,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(email);
  }, [email]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function cancel() {
    setEditing(false);
    setValue(email);
    setError(null);
  }

  async function save() {
    if (saving) return;
    const trimmed = value.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) {
      setError("Email inválido");
      return;
    }
    if (trimmed === email.toLowerCase()) {
      cancel();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al guardar");
        setSaving(false);
        return;
      }
      onSaved?.(trimmed);
      setEditing(false);
    } catch {
      setError("Error de red");
    }
    setSaving(false);
  }

  if (!editing) {
    return (
      <div className="group flex items-center gap-1.5">
        <span className="truncate text-xs text-navy-700">{email}</span>
        {!disabled && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            title="Editar email"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5 text-navy-400 hover:text-navy-700"
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
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              cancel();
            }
          }}
          disabled={saving}
          className="flex-1 min-w-0 rounded-md border border-navy-200 bg-white px-2 py-0.5 font-mono text-xs text-navy-700 outline-none focus:border-gold-500"
          placeholder="email@ejemplo.com"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="shrink-0 rounded-md bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-green-600 disabled:opacity-50"
          title="Guardar (Enter)"
        >
          {saving ? "…" : "OK"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="shrink-0 rounded-md border border-navy-200 px-1.5 py-0.5 text-[10px] font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
          title="Cancelar (Esc)"
        >
          ✕
        </button>
      </div>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
