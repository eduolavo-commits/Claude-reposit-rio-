import Link from "next/link";
import { CourseRow } from "@/components/CourseRow";
import { HeroBanner } from "@/components/HeroBanner";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/access";
import {
  listCategories,
  listEnrolledCourseIds,
  listPublishedCourses,
} from "@/lib/queries";
import type { Course } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  const [courses, categories] = await Promise.all([
    listPublishedCourses(supabase),
    listCategories(supabase),
  ]);

  const enrolledIds = profile
    ? await listEnrolledCourseIds(supabase, profile.user_id)
    : new Set<string>();

  const isUnlocked = (c: Course) =>
    !!profile && (c.access_type === "free" || enrolledIds.has(c.id));

  // Hero: featured course (prefer one the user can access)
  const featured =
    courses.find((c) => c.is_featured && isUnlocked(c)) ??
    courses.find((c) => c.is_featured) ??
    courses[0];

  // Free vitrine
  const freeCourses = courses.filter((c) => c.access_type === "free");

  // Group by category, sort: categories with unlocked courses first
  const byCategory = categories.map((cat) => {
    const list = courses.filter((c) => c.category_id === cat.id);
    list.sort((a, b) => Number(isUnlocked(b)) - Number(isUnlocked(a)));
    const unlockedCount = list.filter(isUnlocked).length;
    return { cat, list, unlockedCount };
  });
  byCategory.sort((a, b) => b.unlockedCount - a.unlockedCount);

  return (
    <div className="space-y-8">
      {featured && <HeroBanner course={featured} locked={!isUnlocked(featured)} />}

      {!profile && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-xl border border-brand/30 bg-brand/10 p-4 text-sm">
            <strong>Crie sua conta grátis</strong> para acessar imediatamente todos os cursos
            gratuitos.{" "}
            <Link href="/cadastro" className="text-brand-accent underline">
              Cadastrar agora
            </Link>
          </div>
        </div>
      )}

      {freeCourses.length > 0 && (
        <CourseRow
          title="Cursos Gratuitos"
          subtitle="Liberados para todos os cadastrados"
          courses={freeCourses.map((c) => ({ ...c, _locked: !isUnlocked(c) }))}
        />
      )}

      {byCategory.map(({ cat, list }) =>
        list.length ? (
          <CourseRow
            key={cat.id}
            title={cat.name}
            courses={list.map((c) => ({ ...c, _locked: !isUnlocked(c) }))}
          />
        ) : null,
      )}
    </div>
  );
}
