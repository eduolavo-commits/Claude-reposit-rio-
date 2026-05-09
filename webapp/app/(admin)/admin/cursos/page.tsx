import Link from "next/link";
import { Plus } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewCourseButton } from "@/components/NewCourseButton";

export const dynamic = "force-dynamic";

export default async function AdminCursosPage() {
  const sb = await createSupabaseServerClient();
  const { data: courses } = await sb
    .from("courses")
    .select("id, slug, title, status, access_type, category:categories(name)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cursos</h1>
        <NewCourseButton />
      </div>
      <div className="overflow-hidden rounded-xl border border-white/5">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Título</th>
              <th className="px-4 py-2">Categoria</th>
              <th className="px-4 py-2">Acesso</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-bg-card">
            {(courses ?? []).map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2">{c.title}</td>
                <td className="px-4 py-2">{(c.category as { name?: string } | null)?.name ?? "—"}</td>
                <td className="px-4 py-2">
                  {c.access_type === "free" ? (
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
                      Grátis
                    </span>
                  ) : (
                    <span className="rounded bg-bg-hover px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                      Pago
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">{c.status === "published" ? "Publicado" : "Rascunho"}</td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/cursos/${c.id}`}
                    className="rounded-md bg-bg-hover px-3 py-1 text-xs hover:text-white"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {(!courses || courses.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Nenhum curso ainda. <Plus size={14} className="inline" /> Crie o primeiro acima.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
