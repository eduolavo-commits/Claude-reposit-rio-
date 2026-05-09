import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { Award, Lock, PlayCircle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/access";
import {
  getCourseBySlug,
  listLessonProgress,
  listModulesWithLessons,
} from "@/lib/queries";
import { formatDuration } from "@/lib/utils";
import { CertificateButton } from "@/components/CertificateButton";

export const dynamic = "force-dynamic";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  const course = await getCourseBySlug(supabase, slug);
  if (!course) notFound();

  // Free courses are open to all logged-in users; paid require enrollment.
  if (!profile) redirect(`/login?next=/cursos/${slug}`);

  // Access check (RLS will also enforce, but UX is friendlier here)
  let unlocked = course.access_type === "free" || ["admin", "support"].includes(profile.role);
  if (!unlocked) {
    const { data } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", profile.user_id)
      .eq("course_id", course.id)
      .eq("status", "active")
      .maybeSingle();
    unlocked = !!data;
  }

  const modules = await listModulesWithLessons(supabase, course.id);
  const allLessons = modules.flatMap((m) => m.lessons);
  const progress = unlocked ? await listLessonProgress(supabase, profile.user_id) : [];
  const completedSet = new Set(progress.map((p) => p.lesson_id));
  const completedCount = allLessons.filter((l) => completedSet.has(l.id)).length;
  const pct = allLessons.length ? Math.round((completedCount / allLessons.length) * 100) : 0;
  const canCertify = pct === 100 && allLessons.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div>
          {course.banner_url || course.thumbnail_url ? (
            <div className="relative aspect-video overflow-hidden rounded-xl">
              <Image
                src={course.banner_url ?? course.thumbnail_url ?? ""}
                alt={course.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </div>
          ) : null}
          <h1 className="mt-4 text-2xl font-bold sm:text-3xl">{course.title}</h1>
          {course.subtitle && (
            <p className="mt-1 text-muted">{course.subtitle}</p>
          )}
          {course.description_md && (
            <article className="prose prose-invert mt-4 max-w-none text-sm text-white/80">
              {course.description_md}
            </article>
          )}
        </div>

        <aside className="space-y-3 rounded-xl border border-white/5 bg-bg-card p-5">
          {!unlocked ? (
            <>
              <div className="flex items-center gap-2 text-amber-300">
                <Lock size={18} /> <strong>Curso bloqueado</strong>
              </div>
              <p className="text-sm text-muted">
                Para acessar este curso, finalize sua compra ou fale com a gente.
              </p>
              {(course.sales_url || course.whatsapp_url) && (
                <a
                  href={course.sales_url ?? course.whatsapp_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-md bg-brand py-2 text-center text-sm font-semibold hover:bg-brand-light"
                >
                  Quero adquirir
                </a>
              )}
            </>
          ) : (
            <>
              <div className="text-sm">
                <div className="flex items-center justify-between">
                  <span>Progresso</span>
                  <span className="font-semibold">{pct}%</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-bg">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {completedCount} de {allLessons.length} aulas concluídas
                </p>
              </div>

              {allLessons[0] && (
                <Link
                  href={`/cursos/${course.slug}/${allLessons.find((l) => !completedSet.has(l.id))?.id ?? allLessons[0].id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2 text-sm font-semibold hover:bg-brand-light"
                >
                  <PlayCircle size={16} /> Continuar curso
                </Link>
              )}

              <CertificateButton courseId={course.id} disabled={!canCertify} />
              {!canCertify && (
                <p className="text-center text-xs text-muted">
                  <Award size={12} className="inline" /> Certificado disponível ao concluir 100%
                </p>
              )}
            </>
          )}
        </aside>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">Conteúdo do curso</h2>
        <div className="space-y-3">
          {modules.length === 0 && (
            <p className="text-sm text-muted">Em breve as aulas serão publicadas.</p>
          )}
          {modules.map((m, mi) => (
            <details
              key={m.id}
              open={mi === 0}
              className="rounded-lg border border-white/5 bg-bg-card p-4"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    Módulo {mi + 1}: {m.title}
                  </h3>
                  <span className="text-xs text-muted">{m.lessons.length} aula(s)</span>
                </div>
              </summary>
              <ul className="mt-3 divide-y divide-white/5">
                {m.lessons.map((l) => {
                  const done = completedSet.has(l.id);
                  return (
                    <li key={l.id}>
                      {unlocked ? (
                        <Link
                          href={`/cursos/${course.slug}/${l.id}`}
                          className="flex items-center justify-between gap-3 py-2 text-sm hover:text-brand-accent"
                        >
                          <span className="flex items-center gap-2">
                            <PlayCircle
                              size={16}
                              className={done ? "text-emerald-500" : "text-muted"}
                            />
                            {l.title}
                          </span>
                          <span className="text-xs text-muted">
                            {formatDuration(l.duration_seconds)}
                          </span>
                        </Link>
                      ) : (
                        <div className="flex items-center justify-between gap-3 py-2 text-sm text-muted">
                          <span className="flex items-center gap-2">
                            <Lock size={14} /> {l.title}
                          </span>
                          <span className="text-xs">{formatDuration(l.duration_seconds)}</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
