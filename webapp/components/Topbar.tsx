import Link from "next/link";
import { Logo } from "./Logo";
import { Award, LayoutGrid, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/access";
import { LogoutButton } from "./LogoutButton";

export async function Topbar() {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
            <Link href="/" className="hover:text-white">Início</Link>
            <Link href="/cursos" className="hover:text-white">Cursos</Link>
            <Link href="/certificados" className="hover:text-white">Certificados</Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {profile ? (
            <>
              {(profile.role === "admin" || profile.role === "support") && (
                <Link
                  href="/admin"
                  className="hidden items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted hover:bg-bg-hover hover:text-white sm:flex"
                >
                  <ShieldCheck size={16} /> Admin
                </Link>
              )}
              <Link
                href="/perfil"
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-bg-hover"
                title={profile.full_name ?? ""}
              >
                <UserRound size={16} />
                <span className="hidden sm:inline">{profile.full_name?.split(" ")[0] ?? "Aluno"}</span>
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-md bg-brand px-3 py-1.5 text-sm font-medium hover:bg-brand-light"
            >
              <LogIn size={16} /> Entrar
            </Link>
          )}
        </div>
      </div>

      {/* Bottom mobile nav */}
      <nav className="grid grid-cols-3 border-t border-white/5 text-xs text-muted md:hidden">
        <Link href="/" className="flex flex-col items-center gap-0.5 py-2">
          <LayoutGrid size={18} /> Início
        </Link>
        <Link href="/cursos" className="flex flex-col items-center gap-0.5 py-2">
          <LayoutGrid size={18} /> Cursos
        </Link>
        <Link href="/certificados" className="flex flex-col items-center gap-0.5 py-2">
          <Award size={18} /> Certificados
        </Link>
      </nav>
    </header>
  );
}
