"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/supabase/types";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CategoriesAdmin({ initial }: { initial: Category[] }) {
  const [items, setItems] = useState(initial);
  const [name, setName] = useState("");
  const router = useRouter();

  async function add() {
    if (!name.trim()) return;
    const sb = createSupabaseBrowserClient();
    const { data } = await sb
      .from("categories")
      .insert({ name: name.trim(), slug: slugify(name), sort_order: (items.at(-1)?.sort_order ?? 0) + 10 })
      .select("*")
      .single();
    if (data) setItems([...items, data as Category]);
    setName("");
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta categoria? Cursos vinculados ficarão sem categoria.")) return;
    const sb = createSupabaseBrowserClient();
    await sb.from("categories").delete().eq("id", id);
    setItems(items.filter((i) => i.id !== id));
    router.refresh();
  }

  return (
    <div className="max-w-xl rounded-xl border border-white/5 bg-bg-card p-5">
      <div className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nova categoria (ex: Marketing Digital)"
          className="flex-1 rounded-md border border-white/10 bg-bg px-3 py-2 text-sm"
        />
        <button onClick={add} className="rounded-md bg-brand px-3 py-2 text-sm font-semibold">
          Adicionar
        </button>
      </div>
      <ul className="divide-y divide-white/5">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2 text-sm">
            <div>
              <span className="font-medium">{c.name}</span>
              <span className="ml-2 text-xs text-muted">/{c.slug}</span>
            </div>
            <button onClick={() => remove(c.id)} className="text-muted hover:text-red-400">
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
