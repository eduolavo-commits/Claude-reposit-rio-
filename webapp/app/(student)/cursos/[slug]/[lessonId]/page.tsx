import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile, hasAccess } from "@/lib/access";
import {
  getCourseBySlug,
  listModulesWithLessons,
} from "@/lib/queries";
import { LessonPlayer } from "@/components/LessonPlayer";
import { LessonComments } from "@/components/LessonComments";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect(`/login?next=/cursos/${slug}/${lessonId}`);

  const course = await getCourseBySlug(supabase, slug);
  if (!course) notFound();

  const access = await hasAccess(supabase, { id: profile.user_id, role: profile.role }, course);
  if (!access) redirect(`/cursos/${slug}`);

  const modules = await listModulesWithLessons(supabase, course.id);
  const flatLessons = modules.flatMap((m) => m.lessons);
  const idx = flatLessons.findIndex((l) => l.id === lessonId);
  if (idx === -1) notFound();
  const lesson = flatLessons[idx]!;
  const prev = flatLessons[idx - 1];
  const next = flatLessons[idx + 1];

  // already completed?
  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", profile.user_id)
    .eq("lesson_id", lesson.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
      <Link
        href={`/cursos/${course.slug}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-white"
      >
        <ArrowLeft size={14} /> Voltar para o curso
      </Link>
      <h1 className="mb-3 text-xl font-semibold sm:text-2xl">{lesson.title}</h1>

      <LessonPlayer
        videoId={lesson.panda_video_id}
        lessonId={lesson.id}
        completed={!!progress}
      />

      <div className="mt-4 flex items-center justify-between">
        {prev ? (
          <Link
            href={`/cursos/${course.slug}/${prev.id}`}
            className="inline-flex items-center gap-1 rounded-md bg-bg-card px-3 py-2 text-sm hover:bg-bg-hover"
          >
            <ChevronLeft size={14} /> Anterior
          </Link>
        ) : <span />}
        {next ? (
          <Link
            href={`/cursos/${course.slug}/${next.id}`}
            className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-2 text-sm font-semibold hover:bg-brand-light"
          >
            Próxima aula <ChevronRight size={14} />
          </Link>
        ) : <span />}
      </div>

      {lesson.materials_url && (
        <div className="mt-6 rounded-lg border border-white/5 bg-bg-card p-3 text-sm">
          <strong>Material da aula:</strong>{" "}
          <a
            href={lesson.materials_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-accent underline"
          >
            baixar
          </a>
        </div>
      )}

      <LessonComments lessonId={lesson.id} />
    </div>
  );
}
