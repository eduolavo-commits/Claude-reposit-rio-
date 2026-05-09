"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { maskCpf } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

export function ProfileForm({ initial }: { initial: Profile }) {
  const [fullName, setFullName] = useState(initial.full_name ?? "");
  const [cpf, setCpf] = useState(initial.cpf ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const sb = createSupabaseBrowserClient();
    await sb
      .from("profiles")
      .update({ full_name: fullName, cpf, phone })
      .eq("user_id", initial.user_id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="rounded-xl border border-white/5 bg-bg-card p-5">
      <label className="block text-sm">
        Nome completo
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-1 w-full rounded-md border border-white/10 bg-bg px-3 py-2"
        />
      </label>
      <label className="mt-3 block text-sm">
        CPF
        <input
          value={cpf}
          onChange={(e) => setCpf(maskCpf(e.target.value))}
          placeholder="000.000.000-00"
          className="mt-1 w-full rounded-md border border-white/10 bg-bg px-3 py-2"
        />
      </label>
      <label className="mt-3 block text-sm">
        Telefone (opcional)
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-md border border-white/10 bg-bg px-3 py-2"
        />
      </label>
      <button
        onClick={save}
        disabled={saving}
        className="mt-4 rounded-md bg-brand px-3 py-2 text-sm font-semibold hover:bg-brand-light disabled:opacity-60"
      >
        {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar"}
      </button>
    </div>
  );
}
