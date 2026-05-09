import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, Course, Lesson, Module } from "./supabase/types";

export async function listPublishedCourses(sb: SupabaseClient) {
  const { data } = await sb
    .from("courses")
    .select("*")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  return (data ?? []) as Course[];
}

export async function listCategories(sb: SupabaseClient) {
  const { data } = await sb
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data ?? []) as Category[];
}

export async function getCourseBySlug(sb: SupabaseClient, slug: string) {
  const { data } = await sb.from("courses").select("*").eq("slug", slug).maybeSingle();
  return data as Course | null;
}

export async function listModulesWithLessons(sb: SupabaseClient, courseId: string) {
  const { data: modules } = await sb
    .from("modules")
    .select("*")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });
  if (!modules?.length) return [] as (Module & { lessons: Lesson[] })[];
  const moduleIds = modules.map((m) => m.id);
  const { data: lessons } = await sb
    .from("lessons")
    .select("*")
    .in("module_id", moduleIds)
    .order("sort_order", { ascending: true });
  return modules.map((m) => ({
    ...(m as Module),
    lessons: (lessons ?? []).filter((l) => l.module_id === m.id) as Lesson[],
  }));
}

export async function listEnrolledCourseIds(sb: SupabaseClient, userId: string) {
  const { data } = await sb
    .from("enrollments")
    .select("course_id")
    .eq("user_id", userId)
    .eq("status", "active");
  return new Set((data ?? []).map((d) => d.course_id as string));
}

export async function listLessonProgress(sb: SupabaseClient, userId: string) {
  const { data } = await sb
    .from("lesson_progress")
    .select("lesson_id, completed_at")
    .eq("user_id", userId);
  return data ?? [];
}
