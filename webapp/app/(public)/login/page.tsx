"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const sb = createSupabaseBrowserClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Email ou senha incorretos.");
      return;
    }
    router.push(next);
    router.refresh();
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
        <h1 className="text-xl font-semibold">Entrar na minha conta</h1>
        <p className="mt-1 text-sm text-muted">Use o email cadastrado.</p>

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
        <label className="mt-3 block text-sm">
          Senha
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-bg px-3 py-2 outline-none focus:border-brand"
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button
          disabled={loading}
          className="mt-5 w-full rounded-md bg-brand px-3 py-2 text-sm font-semibold hover:bg-brand-light disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <div className="mt-4 flex justify-between text-xs text-muted">
          <Link href="/recuperar-senha" className="hover:text-white">
            Esqueci minha senha
          </Link>
          <Link href="/cadastro" className="hover:text-white">
            Criar conta grátis
          </Link>
        </div>
      </form>
    </div>
  );
}
