import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/Logo";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { formatDateBR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  // Use service role to bypass RLS for public verification — only safe fields exposed.
  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("certificates")
    .select(
      "id, type, full_name_snapshot, last_issued_at, first_issued_at, course:courses(title)",
    )
    .eq("code", code)
    .maybeSingle();

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-xl border border-white/5 bg-bg-card p-6 text-center shadow-glow">
        <div className="mb-4 flex justify-center">
          <Logo size={36} />
        </div>
        {data ? (
          <>
            <ShieldCheck className="mx-auto text-emerald-400" size={48} />
            <h1 className="mt-3 text-xl font-semibold">Certificado autêntico</h1>
            <p className="mt-2 text-sm text-muted">
              Emitido para <strong className="text-white">{data.full_name_snapshot}</strong>
            </p>
            <p className="mt-1 text-sm text-muted">
              Curso: <strong className="text-white">{(data.course as { title?: string } | null)?.title ?? "—"}</strong>
            </p>
            <p className="mt-1 text-xs text-muted">
              Emissão: {formatDateBR(data.first_issued_at)} · Atualizado:{" "}
              {formatDateBR(data.last_issued_at)}
            </p>
          </>
        ) : (
          <>
            <ShieldAlert className="mx-auto text-amber-400" size={48} />
            <h1 className="mt-3 text-xl font-semibold">Código não encontrado</h1>
            <p className="mt-2 text-sm text-muted">
              Verifique se o link está correto e tente novamente.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
