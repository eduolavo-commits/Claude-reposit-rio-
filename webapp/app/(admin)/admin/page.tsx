import { GraduationCap, Inbox, Users } from "lucide-react";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const sb = await createSupabaseServerClient();
  const [{ count: students }, { count: courses }, { count: open }] = await Promise.all([
    sb.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
    sb.from("courses").select("*", { count: "exact", head: true }),
    sb.from("comments").select("*", { count: "exact", head: true }).is("parent_id", null).eq("status", "open"),
  ]);

  const cards = [
    { label: "Alunos", value: students ?? 0, href: "/admin/alunos", icon: Users },
    { label: "Cursos", value: courses ?? 0, href: "/admin/cursos", icon: GraduationCap },
    { label: "Dúvidas em aberto", value: open ?? 0, href: "/admin/suporte", icon: Inbox },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Visão geral</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-white/5 bg-bg-card p-5 hover:bg-bg-hover"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{label}</span>
              <Icon size={18} className="text-muted" />
            </div>
            <div className="mt-2 text-3xl font-bold">{value}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
