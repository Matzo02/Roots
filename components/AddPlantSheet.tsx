"use client";

import type { Plant } from "@/lib/types";
import clsx from "clsx";
import { Loader2, MessageCircle, Smartphone, Sparkles, Upload, X } from "lucide-react";
import { useState } from "react";

type Source = "whatsapp" | "imessage";

export default function AddPlantSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (plant: Plant) => void;
}) {
  const [source, setSource] = useState<Source>("whatsapp");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [imessageHandle, setImessageHandle] = useState("");
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
  const valid =
    source === "whatsapp"
      ? name.trim().length > 0 && /^\d{8,15}$/.test(cleanPhone) && file
      : name.trim().length > 0 && imessageHandle.trim().length >= 3;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      let res: Response;
      if (source === "whatsapp") {
        const fd = new FormData();
        fd.append("file", file!);
        fd.append("name", name.trim());
        fd.append("phone", cleanPhone);
        if (handle.trim()) fd.append("handle", handle.trim());
        fd.append("channel", channel);
        if (publicContext.trim())
          fd.append("publicContext", publicContext.trim());
        res = await fetch("/api/import", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/import-imessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            handle: imessageHandle.trim(),
            publicContext: publicContext.trim() || undefined,
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onAdded(data.plant);
      setName("");
      setPhone("");
      setHandle("");
      setImessageHandle("");
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
              {/* Source toggle */}
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)] mb-1.5">
                  Source
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <SourceButton
                    active={source === "whatsapp"}
                    onClick={() => {
                      setSource("whatsapp");
                      setChannel("whatsapp");
                    }}
                    icon={<MessageCircle className="w-4 h-4" />}
                    label="WhatsApp export"
                    hint=".txt file"
                  />
                  <SourceButton
                    active={source === "imessage"}
                    onClick={() => {
                      setSource("imessage");
                      setChannel("imessage");
                    }}
                    icon={<Smartphone className="w-4 h-4" />}
                    label="iMessage"
                    hint="reads chat.db (Mac)"
                  />
                </div>
              </div>

              <Field label="Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Anjali"
                  className="input-pixel"
                />
              </Field>

              {source === "whatsapp" ? (
                <>
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

                  <Field
                    label="WhatsApp chat export (.txt)"
                    hint="In WhatsApp: chat → menu → Export chat → without media"
                  >
                    <FileDrop file={file} onChange={setFile} />
                  </Field>
                </>
              ) : (
                <Field
                  label="iMessage handle"
                  hint="Phone with country code (+919876543210) or email used for iMessage"
                >
                  <input
                    value={imessageHandle}
                    onChange={(e) => setImessageHandle(e.target.value)}
                    placeholder="+919876543210"
                    className="input-pixel"
                  />
                </Field>
              )}

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

function SourceButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex flex-col items-start gap-1 px-3 py-2.5 rounded-2xl text-left border-2 transition-all",
        active
          ? "bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-300"
          : "bg-white/60 border-transparent hover:bg-white/80",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={active ? "text-emerald-700" : "text-[var(--color-ink-muted)]"}>
          {icon}
        </span>
        <span
          className={clsx(
            "text-sm font-semibold",
            active ? "text-emerald-800" : "text-[var(--color-ink)]",
          )}
        >
          {label}
        </span>
      </div>
      <span className="text-[11px] text-[var(--color-ink-muted)]">
        {hint}
      </span>
    </button>
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
