"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Profile {
  user_id: string;
  full_name: string | null;
  cpf: string | null;
  role: string;
  created_at: string;
}
interface Course {
  id: string;
  title: string;
}
interface EnrRow {
  user_id: string;
  course_id: string;
  status: string;
  source: string;
}

export function StudentsAdmin({
  profiles,
  courses,
  enrollments,
}: {
  profiles: Profile[];
  courses: Course[];
  enrollments: EnrRow[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return profiles.filter(
      (p) =>
        !s ||
        p.full_name?.toLowerCase().includes(s) ||
        p.cpf?.includes(s) ||
        p.user_id.includes(s),
    );
  }, [profiles, q]);

  const enrByUser = useMemo(() => {
    const m = new Map<string, Set<string>>();
    enrollments.filter((e) => e.status === "active").forEach((e) => {
      if (!m.has(e.user_id)) m.set(e.user_id, new Set());
      m.get(e.user_id)!.add(e.course_id);
    });
    return m;
  }, [enrollments]);

  async function toggle(userId: string, courseId: string, on: boolean) {
    const sb = createSupabaseBrowserClient();
    if (on) {
      await sb.from("enrollments").upsert(
        { user_id: userId, course_id: courseId, status: "active", source: "admin" },
        { onConflict: "user_id,course_id" },
      );
    } else {
      await sb
        .from("enrollments")
        .update({ status: "revoked" })
        .eq("user_id", userId)
        .eq("course_id", courseId);
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-md border border-white/10 bg-bg-card px-3 py-2 text-sm">
        <Search size={14} className="text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, CPF ou ID..."
          className="w-full bg-transparent outline-none"
        />
      </div>
      <div className="overflow-hidden rounded-xl border border-white/5">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Aluno</th>
              <th className="px-4 py-2">Cursos liberados</th>
              <th className="px-4 py-2">Liberar/revogar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-bg-card">
            {filtered.map((p) => {
              const enrolled = enrByUser.get(p.user_id) ?? new Set();
              return (
                <tr key={p.user_id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.full_name ?? "—"}</div>
                    <div className="text-xs text-muted">{p.cpf ?? ""}</div>
                    <div className="text-[10px] uppercase text-muted">{p.role}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {courses
                      .filter((c) => enrolled.has(c.id))
                      .map((c) => c.title)
                      .join(", ") || <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      onChange={(e) => {
                        const cid = e.target.value;
                        if (!cid) return;
                        toggle(p.user_id, cid, !enrolled.has(cid));
                        e.target.value = "";
                      }}
                      className="rounded-md border border-white/10 bg-bg px-2 py-1 text-xs"
                    >
                      <option value="">— ação rápida —</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {enrolled.has(c.id) ? `Revogar: ${c.title}` : `Liberar: ${c.title}`}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted">
                  Nenhum aluno encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
