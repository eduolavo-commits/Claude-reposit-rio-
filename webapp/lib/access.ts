import type { SupabaseClient } from "@supabase/supabase-js";
import type { Course, Profile } from "./supabase/types";

/**
 * Single source of truth for "can this user access this course?".
 * Free courses are accessible to any authenticated user.
 * Paid courses require an active enrollment row.
 * Admin/support roles bypass.
 */
export async function hasAccess(
  supabase: SupabaseClient,
  user: { id: string; role?: string } | null,
  course: Pick<Course, "id" | "access_type">,
): Promise<boolean> {
  if (!user) return false;
  if (user.role === "admin" || user.role === "support") return true;
  if (course.access_type === "free") return true;

  const { data } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", course.id)
    .eq("status", "active")
    .maybeSingle();
  return !!data;
}

export async function getCurrentProfile(
  supabase: SupabaseClient,
): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return data as Profile | null;
}
