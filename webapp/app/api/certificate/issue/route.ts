import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isValidCpf } from "@/lib/utils";

const Body = z.object({
  course_id: z.string().uuid(),
  full_name: z.string().min(3),
  cpf: z.string(),
  type: z.enum(["certificate", "recommendation"]).default("certificate"),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { course_id, full_name, cpf, type } = parsed.data;

  if (!isValidCpf(cpf)) {
    return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
  }

  // Check access (free course or active enrollment)
  const { data: course } = await supabase
    .from("courses")
    .select("id, access_type, title")
    .eq("id", course_id)
    .maybeSingle();
  if (!course) return NextResponse.json({ error: "course_not_found" }, { status: 404 });

  if (course.access_type !== "free") {
    const { data: enr } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", course_id)
      .eq("status", "active")
      .maybeSingle();
    if (!enr) return NextResponse.json({ error: "no_access" }, { status: 403 });
  }

  // Check 100% completion
  const { data: modules } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", course_id);
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id")
    .in("module_id", moduleIds.length ? moduleIds : ["00000000-0000-0000-0000-000000000000"]);
  const lessonIds = (lessons ?? []).map((l) => l.id);
  if (lessonIds.length === 0) {
    return NextResponse.json({ error: "Curso sem aulas." }, { status: 400 });
  }
  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", user.id)
    .in("lesson_id", lessonIds);
  if ((progress ?? []).length < lessonIds.length) {
    return NextResponse.json(
      { error: "Conclua 100% das aulas para emitir o certificado." },
      { status: 400 },
    );
  }

  // Update profile snapshot
  await supabase
    .from("profiles")
    .update({ full_name, cpf })
    .eq("user_id", user.id);

  // Upsert certificate
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("certificates")
    .select("id, first_issued_at")
    .eq("user_id", user.id)
    .eq("course_id", course_id)
    .eq("type", type)
    .maybeSingle();

  let id: string;
  if (existing) {
    const { error } = await supabase
      .from("certificates")
      .update({
        full_name_snapshot: full_name,
        cpf_snapshot: cpf,
        last_issued_at: now,
      })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    id = existing.id;
  } else {
    const { data: ins, error } = await supabase
      .from("certificates")
      .insert({
        user_id: user.id,
        course_id,
        type,
        full_name_snapshot: full_name,
        cpf_snapshot: cpf,
        first_issued_at: now,
        last_issued_at: now,
      })
      .select("id")
      .single();
    if (error || !ins) return NextResponse.json({ error: error?.message }, { status: 500 });
    id = ins.id;
  }

  return NextResponse.json({ id });
}
