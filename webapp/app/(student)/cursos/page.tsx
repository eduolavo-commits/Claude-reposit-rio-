import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/access";
import {
  listEnrolledCourseIds,
  listPublishedCourses,
} from "@/lib/queries";
import { CourseCard } from "@/components/CourseCard";
import type { Course } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  const courses = await listPublishedCourses(supabase);
  const enrolled = profile
    ? await listEnrolledCourseIds(supabase, profile.user_id)
    : new Set<string>();
  const isUnlocked = (c: Course) =>
    !!profile && (c.access_type === "free" || enrolled.has(c.id));

  // Unlocked first
  const sorted = [...courses].sort(
    (a, b) => Number(isUnlocked(b)) - Number(isUnlocked(a)),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-2xl font-semibold">Todos os cursos</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((c) => (
          <CourseCard key={c.id} course={c} locked={!isUnlocked(c)} />
        ))}
      </div>
    </div>
  );
}
