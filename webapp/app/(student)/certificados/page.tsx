import { Award } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/access";
import { formatDateBR } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface CertRow {
  id: string;
  type: "certificate" | "recommendation";
  last_issued_at: string;
  course: { title: string; slug: string } | null;
}

export default async function CertificadosPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login?next=/certificados");

  const { data } = await supabase
    .from("certificates")
    .select("id, type, last_issued_at, course:courses(title, slug)")
    .eq("user_id", profile.user_id)
    .order("last_issued_at", { ascending: false });

  const certs = (data ?? []) as unknown as CertRow[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-2xl font-semibold">Meus certificados</h1>
      {certs.length === 0 && (
        <p className="text-sm text-muted">
          Você ainda não emitiu nenhum certificado. Conclua um curso para liberar.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {certs.map((c) => (
          <article
            key={c.id}
            className="rounded-xl border border-white/5 bg-bg-card p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
                  {c.type === "recommendation" ? "Carta" : "Certificado"}
                </span>
                <h3 className="mt-2 font-semibold">{c.course?.title ?? "Curso"}</h3>
                <p className="mt-1 text-xs text-muted">
                  Última emissão: {formatDateBR(c.last_issued_at)}
                </p>
              </div>
              <Award className="text-brand-accent" />
            </div>
            <div className="mt-3 flex gap-2">
              <a
                href={`/api/certificate/${c.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold hover:bg-brand-light"
              >
                Baixar PDF
              </a>
              {c.course && (
                <Link
                  href={`/cursos/${c.course.slug}`}
                  className="rounded-md bg-bg-hover px-3 py-1.5 text-xs text-muted hover:text-white"
                >
                  Reemitir
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
