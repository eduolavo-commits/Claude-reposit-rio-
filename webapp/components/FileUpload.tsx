"use client";

import { Upload, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  /** Pasta lógica dentro do bucket "course-assets" (ex: "courses/<id>/cert"). */
  folder: string;
  value: string | null;
  onChange: (url: string | null) => void;
  accept?: string;
  label?: string;
  hint?: string;
}

export function FileUpload({
  folder,
  value,
  onChange,
  accept = "image/png,image/jpeg",
  label = "Enviar imagem",
  hint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const sb = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, "");
      const objectPath = `${safeFolder}/${Date.now()}.${ext}`;
      const { error } = await sb.storage
        .from("course-assets")
        .upload(objectPath, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = sb.storage.from("course-assets").getPublicUrl(objectPath);
      onChange(data.publicUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
        }}
      />
      {value ? (
        <div className="flex items-start gap-3 rounded-md border border-white/10 bg-bg p-2">
          <div className="relative h-20 w-32 overflow-hidden rounded bg-bg-card">
            <Image src={value} alt="preview" fill className="object-contain" sizes="128px" />
          </div>
          <div className="flex flex-1 flex-col items-start gap-2">
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-xs text-brand-accent underline"
            >
              {value.split("/").pop()}
            </a>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="rounded-md bg-bg-hover px-3 py-1 text-xs hover:text-white disabled:opacity-60"
              >
                {busy ? "Enviando..." : "Trocar"}
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="rounded-md bg-bg-hover px-3 py-1 text-xs text-muted hover:text-red-400"
              >
                <X size={12} className="inline" /> Remover
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/15 bg-bg px-3 py-6 text-sm text-muted hover:border-brand hover:text-white disabled:opacity-60"
        >
          <Upload size={14} /> {busy ? "Enviando..." : label}
        </button>
      )}
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
      {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
    </div>
  );
}
