import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listCategories, listModulesWithLessons } from "@/lib/queries";
import { CourseEditor } from "@/components/CourseEditor";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();
  const { data: course } = await sb.from("courses").select("*").eq("id", id).maybeSingle();
  if (!course) notFound();
  const [cats, modules] = await Promise.all([
    listCategories(sb),
    listModulesWithLessons(sb, id),
  ]);
  return <CourseEditor course={course} categories={cats} modules={modules} />;
}
