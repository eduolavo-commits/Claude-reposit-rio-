"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Course {
  id: string;
  title: string;
}
interface Mapping {
  id: string;
  provider: string;
  external_product_id: string;
  course_id: string;
}
interface EventRow {
  id: string;
  provider: string;
  processed_at: string | null;
  error: string | null;
  created_at: string;
}

const PROVIDERS = ["hotmart", "kiwify", "eduzz", "cademi"] as const;

export function WebhooksAdmin({
  courses,
  mappings,
  events,
}: {
  courses: Course[];
  mappings: Mapping[];
  events: EventRow[];
}) {
  const router = useRouter();
  const [provider, setProvider] = useState<typeof PROVIDERS[number]>("hotmart");
  const [extId, setExtId] = useState("");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");

  async function add() {
    if (!extId || !courseId) return;
    const sb = createSupabaseBrowserClient();
    await sb.from("product_mappings").insert({
      provider,
      external_product_id: extId,
      course_id: courseId,
    });
    setExtId("");
    router.refresh();
  }

  async function remove(id: string) {
    const sb = createSupabaseBrowserClient();
    await sb.from("product_mappings").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="mb-3 text-lg font-semibold">URLs dos webhooks</h2>
        <p className="text-sm text-muted">
          Cole estas URLs no painel de cada gateway. Os segredos opcionais ficam nas variáveis
          de ambiente <code>HOTMART_WEBHOOK_SECRET</code>, <code>KIWIFY_WEBHOOK_SECRET</code>,
          <code> EDUZZ_WEBHOOK_SECRET</code>, <code>CADEMI_WEBHOOK_SECRET</code>.
        </p>
        <ul className="mt-3 space-y-1 text-xs">
          {PROVIDERS.map((p) => (
            <li key={p}>
              <strong className="capitalize">{p}:</strong>{" "}
              <code>https://SEU-DOMINIO/api/webhooks/{p}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="mb-3 text-lg font-semibold">Mapear produtos → cursos</h2>
        <div className="grid gap-2 sm:grid-cols-[140px_1fr_1fr_120px]">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as typeof PROVIDERS[number])}
            className="rounded-md border border-white/10 bg-bg px-2 py-2 text-sm capitalize"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            value={extId}
            onChange={(e) => setExtId(e.target.value)}
            placeholder="ID do produto na plataforma externa"
            className="rounded-md border border-white/10 bg-bg px-3 py-2 text-sm"
          />
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="rounded-md border border-white/10 bg-bg px-3 py-2 text-sm"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <button onClick={add} className="rounded-md bg-brand px-3 py-2 text-sm font-semibold">
            Mapear
          </button>
        </div>
        <ul className="mt-4 divide-y divide-white/5 text-sm">
          {mappings.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2">
              <span>
                <strong className="capitalize">{m.provider}</strong> · {m.external_product_id} →{" "}
                {courses.find((c) => c.id === m.course_id)?.title ?? "—"}
              </span>
              <button
                onClick={() => remove(m.id)}
                className="text-muted hover:text-red-400"
                title="Remover"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
          {mappings.length === 0 && (
            <li className="py-2 text-muted">Nenhum mapeamento ainda.</li>
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="mb-3 text-lg font-semibold">Últimos eventos recebidos</h2>
        <table className="w-full text-xs">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-2 py-1">Data</th>
              <th className="px-2 py-1">Provedor</th>
              <th className="px-2 py-1">Status</th>
              <th className="px-2 py-1">Erro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {events.map((e) => (
              <tr key={e.id}>
                <td className="px-2 py-1">{new Date(e.created_at).toLocaleString("pt-BR")}</td>
                <td className="px-2 py-1 capitalize">{e.provider}</td>
                <td className="px-2 py-1">
                  {e.processed_at ? "processado" : "pendente"}
                </td>
                <td className="px-2 py-1 text-red-400">{e.error ?? ""}</td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-center text-muted">
                  Nenhum evento ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
