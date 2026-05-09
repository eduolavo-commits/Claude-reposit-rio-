import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CategoriesAdmin } from "@/components/CategoriesAdmin";
import { listCategories } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const sb = await createSupabaseServerClient();
  const cats = await listCategories(sb);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Categorias</h1>
      <CategoriesAdmin initial={cats} />
    </div>
  );
}
