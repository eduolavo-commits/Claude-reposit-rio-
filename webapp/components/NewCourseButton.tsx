"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function NewCourseButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create() {
    const title = prompt("Nome do novo curso?");
    if (!title) return;
    setBusy(true);
    const sb = createSupabaseBrowserClient();
    const { data } = await sb
      .from("courses")
      .insert({
        title,
        slug: slugify(title) + "-" + Date.now().toString(36),
        status: "draft",
        access_type: "paid",
      })
      .select("id")
      .single();
    setBusy(false);
    if (data) router.push(`/admin/cursos/${data.id}`);
  }

  return (
    <button
      onClick={create}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-2 text-sm font-semibold hover:bg-brand-light disabled:opacity-60"
    >
      <Plus size={14} /> Novo curso
    </button>
  );
}
