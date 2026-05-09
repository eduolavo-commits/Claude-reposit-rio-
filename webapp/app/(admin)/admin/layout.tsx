import Link from "next/link";
import { redirect } from "next/navigation";
import {
  GraduationCap,
  Inbox,
  LayoutDashboard,
  ListTree,
  Tag,
  Users,
  Webhook,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/access";

const NAV = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/cursos", label: "Cursos", icon: GraduationCap },
  { href: "/admin/categorias", label: "Categorias", icon: Tag },
  { href: "/admin/alunos", label: "Alunos", icon: Users },
  { href: "/admin/suporte", label: "Inbox de suporte", icon: Inbox },
  { href: "/admin/webhooks", label: "Webhooks", icon: Webhook },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login?next=/admin");
  if (profile.role !== "admin" && profile.role !== "support") redirect("/");

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="border-r border-white/5 bg-bg-soft p-4">
        <div className="mb-6">
          <Logo />
        </div>
        <nav className="space-y-1 text-sm">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-muted hover:bg-bg-hover hover:text-white"
            >
              <Icon size={16} /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 flex items-center justify-between rounded-md bg-bg-card p-2 text-xs">
          <div>
            <ListTree size={14} className="inline" /> {profile.full_name?.split(" ")[0] ?? "Admin"}
            <div className="text-[10px] uppercase text-muted">{profile.role}</div>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <main className="p-6">{children}</main>
    </div>
  );
}
