"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoading(false);
    setDone(true);
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-white/5 bg-bg-card p-6 shadow-glow"
      >
        <div className="mb-6 flex justify-center">
          <Logo size={36} />
        </div>
        <h1 className="text-xl font-semibold">Recuperar senha</h1>
        <p className="mt-1 text-sm text-muted">
          Enviaremos um link para você definir uma nova senha.
        </p>
        <label className="mt-4 block text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-bg px-3 py-2 outline-none focus:border-brand"
          />
        </label>
        {done && (
          <p className="mt-3 text-sm text-emerald-300">Pronto! Verifique sua caixa de entrada.</p>
        )}
        <button
          disabled={loading || done}
          className="mt-5 w-full rounded-md bg-brand px-3 py-2 text-sm font-semibold hover:bg-brand-light disabled:opacity-60"
        >
          {loading ? "Enviando..." : "Enviar link"}
        </button>
        <div className="mt-4 text-center text-xs text-muted">
          <Link href="/login" className="hover:text-white">Voltar</Link>
        </div>
      </form>
    </div>
  );
}
