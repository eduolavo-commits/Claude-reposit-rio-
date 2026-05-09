import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StudentsAdmin } from "@/components/StudentsAdmin";

export const dynamic = "force-dynamic";

export default async function AlunosPage() {
  const sb = await createSupabaseServerClient();
  const [{ data: profiles }, { data: courses }, { data: enr }] = await Promise.all([
    sb.from("profiles").select("user_id, full_name, cpf, role, created_at").order("created_at", { ascending: false }),
    sb.from("courses").select("id, title").order("title"),
    sb.from("enrollments").select("user_id, course_id, status, source"),
  ]);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Alunos</h1>
      <StudentsAdmin
        profiles={profiles ?? []}
        courses={courses ?? []}
        enrollments={enr ?? []}
      />
    </div>
  );
}
