"use client";

import type { Plant } from "@/lib/types";
import clsx from "clsx";
import { Loader2, Sparkles, Upload, X } from "lucide-react";
import { useState } from "react";

export default function AddPlantSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (plant: Plant) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [handle, setHandle] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "imessage" | "call">(
    "whatsapp",
  );
  const [publicContext, setPublicContext] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const cleanPhone = phone.replace(/\D/g, "");
  const valid = name.trim().length > 0 && /^\d{8,15}$/.test(cleanPhone) && file;

  const submit = async () => {
    if (!valid || !file) return;
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name.trim());
      fd.append("phone", cleanPhone);
      if (handle.trim()) fd.append("handle", handle.trim());
      fd.append("channel", channel);
      if (publicContext.trim()) fd.append("publicContext", publicContext.trim());

      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onAdded(data.plant);
      // Reset
      setName("");
      setPhone("");
      setHandle("");
      setPublicContext("");
      setFile(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/30 anim-pop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl"
      >
        <div className="absolute -inset-6 rounded-[3rem] blur-2xl opacity-50 pointer-events-none bg-gradient-to-br from-emerald-200/40 via-lime-200/30 to-amber-200/30" />

        <div className="relative bg-[var(--color-paper)] rounded-[2rem] surface-raised overflow-hidden">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 btn btn-ghost p-2 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 md:p-7">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                New plant
              </span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-semibold text-[var(--color-ink)] mb-1.5 tracking-tight">
              Plant someone in your garden
            </h2>
            <p className="text-sm text-[var(--color-ink-soft)] mb-5">
              Drop a WhatsApp chat export. The agent reads the relationship —
              never sends anything.
            </p>

            <div className="space-y-4">
              <Field label="Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Anjali"
                  className="input-pixel"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Phone (with country code)"
                  hint="digits only"
                >
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="919876543210"
                    inputMode="numeric"
                    className="input-pixel"
                  />
                </Field>
                <Field label="Handle (optional)">
                  <input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="@anjali"
                    className="input-pixel"
                  />
                </Field>
              </div>

              <Field label="Send via">
                <div className="flex gap-2">
                  {(
                    [
                      ["whatsapp", "WhatsApp"],
                      ["imessage", "iMessage"],
                      ["call", "Call"],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => setChannel(k)}
                      className={clsx(
                        "flex-1 px-3 py-2 rounded-2xl text-sm font-semibold border-2 transition-all",
                        channel === k
                          ? "bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-300 text-emerald-800"
                          : "bg-white/60 border-transparent text-[var(--color-ink-muted)] hover:bg-white/80",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field
                label="What are they up to (optional)"
                hint="public context — bio line, recent post, anything you want the agent to know"
              >
                <textarea
                  value={publicContext}
                  onChange={(e) => setPublicContext(e.target.value)}
                  rows={2}
                  placeholder="Just got a PM role at Atlassian. Posts a lot about books."
                  className="input-pixel"
                />
              </Field>

              <Field
                label="WhatsApp chat export (.txt)"
                hint="In WhatsApp: chat → menu → Export chat → without media"
              >
                <FileDrop file={file} onChange={setFile} />
              </Field>

              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
                  {error}
                </div>
              )}

              <button
                onClick={submit}
                disabled={!valid || submitting}
                className="btn btn-primary w-full py-3 text-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Reading the relationship…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Plant</span>
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-[var(--color-ink-muted)] italic">
                Stays on your machine. Nothing is sent except to the AI for
                observation.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        :global(.input-pixel) {
          width: 100%;
          padding: 0.625rem 0.875rem;
          background: rgba(255, 255, 255, 0.7);
          border: 2px solid rgba(28, 40, 38, 0.1);
          border-radius: 0.75rem;
          font-size: 0.95rem;
          color: var(--color-ink);
          font-family: var(--font-body);
          transition: all 200ms;
          outline: none;
        }
        :global(.input-pixel:focus) {
          border-color: rgb(110 231 183 / 1);
          background: white;
        }
        :global(.input-pixel::placeholder) {
          color: rgb(28 40 38 / 0.4);
        }
        :global(textarea.input-pixel) {
          resize: none;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)] block mb-1.5">
          {label}
        </span>
        {children}
      </label>
      {hint && (
        <p className="mt-1 text-[11px] text-[var(--color-ink-muted)] italic">
          {hint}
        </p>
      )}
    </div>
  );
}

function FileDrop({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onChange(f);
      }}
      className={clsx(
        "flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all",
        hover
          ? "border-emerald-400 bg-emerald-50/60"
          : file
            ? "border-emerald-300 bg-emerald-50/40"
            : "border-black/15 bg-white/40 hover:border-emerald-300 hover:bg-emerald-50/30",
      )}
    >
      <input
        type="file"
        accept=".txt"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <Upload
        className={clsx(
          "w-5 h-5",
          file ? "text-emerald-600" : "text-[var(--color-ink-muted)]",
        )}
      />
      {file ? (
        <span className="text-sm text-emerald-700 font-medium">
          {file.name} · {(file.size / 1024).toFixed(0)} KB
        </span>
      ) : (
        <span className="text-sm text-[var(--color-ink-muted)]">
          Drop the .txt or click to choose
        </span>
      )}
    </label>
  );
}
