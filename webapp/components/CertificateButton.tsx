"use client";

import { Award, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidCpf, maskCpf } from "@/lib/utils";

export function CertificateButton({
  courseId,
  disabled,
}: {
  courseId: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 py-2 text-sm font-semibold hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Award size={16} /> Emitir Certificado
      </button>
      {open && (
        <CertificateDialog
          courseId={courseId}
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function CertificateDialog({
  courseId,
  onClose,
}: {
  courseId: string;
  onClose: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [type, setType] = useState<"certificate" | "recommendation">("certificate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (fullName.trim().split(" ").length < 2) {
      setError("Informe seu nome completo (nome e sobrenome).");
      return;
    }
    if (!isValidCpf(cpf)) {
      setError("CPF inválido.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/certificate/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ course_id: courseId, full_name: fullName, cpf, type }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Falha ao emitir certificado.");
      return;
    }
    const { id } = await res.json();
    window.open(`/api/certificate/${id}/pdf`, "_blank");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-white/5 bg-bg-card p-5 shadow-glow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Emitir documento</h3>
          <button onClick={onClose} className="text-muted hover:text-white">
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-sm text-muted">
          Confirme seus dados. O nome e CPF informados aqui serão impressos no documento.
          Em reemissões, atualizamos a data automaticamente.
        </p>

        <div className="mb-3 flex gap-2 text-xs">
          {(["certificate", "recommendation"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={
                "rounded-md px-3 py-1 " +
                (type === t ? "bg-brand text-white" : "bg-bg-hover text-muted")
              }
            >
              {t === "certificate" ? "Certificado" : "Carta de Recomendação"}
            </button>
          ))}
        </div>

        <label className="block text-sm">
          Nome completo
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-bg px-3 py-2 outline-none focus:border-brand"
          />
        </label>
        <label className="mt-3 block text-sm">
          CPF
          <input
            value={cpf}
            onChange={(e) => setCpf(maskCpf(e.target.value))}
            placeholder="000.000.000-00"
            className="mt-1 w-full rounded-md border border-white/10 bg-bg px-3 py-2 outline-none focus:border-brand"
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md bg-bg-hover px-3 py-2 text-sm text-muted hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="rounded-md bg-brand px-3 py-2 text-sm font-semibold hover:bg-brand-light disabled:opacity-60"
          >
            {loading ? "Gerando..." : "Gerar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
