"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

export default function CadastroPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const sb = createSupabaseBrowserClient();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.push("/");
      router.refresh();
    } else {
      setDone(true);
    }
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
        <h1 className="text-xl font-semibold">Criar conta grátis</h1>
        <p className="mt-1 text-sm text-muted">
          Acesse imediatamente todos os cursos gratuitos da plataforma.
        </p>

        {done ? (
          <div className="mt-5 rounded-md border border-emerald-700/30 bg-emerald-900/20 p-3 text-sm text-emerald-200">
            Quase lá! Confirme seu email para ativar a conta.
          </div>
        ) : (
          <>
            <label className="mt-4 block text-sm">
              Nome completo
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-bg px-3 py-2 outline-none focus:border-brand"
              />
            </label>
            <label className="mt-3 block text-sm">
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
              Senha (mín. 8 caracteres)
              <input
                type="password"
                minLength={8}
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
              {loading ? "Criando conta..." : "Criar conta grátis"}
            </button>
          </>
        )}

        <div className="mt-4 text-center text-xs text-muted">
          Já tem conta?{" "}
          <Link href="/login" className="text-brand-light hover:underline">
            Entrar
          </Link>
        </div>
      </form>
    </div>
  );
}
