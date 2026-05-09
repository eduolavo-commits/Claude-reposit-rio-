import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/access";
import { ProfileForm } from "@/components/ProfileForm";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const sb = await createSupabaseServerClient();
  const profile = await getCurrentProfile(sb);
  if (!profile) redirect("/login?next=/perfil");
  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-2xl font-semibold">Meu perfil</h1>
      <ProfileForm initial={profile} />
    </div>
  );
}
