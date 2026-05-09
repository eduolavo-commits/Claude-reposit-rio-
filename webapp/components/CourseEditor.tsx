"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Category, Course, Lesson, Module } from "@/lib/supabase/types";
import { FileUpload } from "./FileUpload";

type ModuleWithLessons = Module & { lessons: Lesson[] };

export function CourseEditor({
  course,
  categories,
  modules,
}: {
  course: Course;
  categories: Category[];
  modules: ModuleWithLessons[];
}) {
  const router = useRouter();
  const [c, setC] = useState(course);
  const [mods, setMods] = useState<ModuleWithLessons[]>(modules);
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function set<K extends keyof Course>(k: K, v: Course[K]) {
    setC({ ...c, [k]: v });
  }

  function saveCourse() {
    start(async () => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb
        .from("courses")
        .update({
          title: c.title,
          subtitle: c.subtitle,
          description_md: c.description_md,
          thumbnail_url: c.thumbnail_url,
          banner_url: c.banner_url,
          category_id: c.category_id,
          access_type: c.access_type,
          sales_url: c.sales_url,
          whatsapp_url: c.whatsapp_url,
          syllabus_md: c.syllabus_md,
          recommendation_role: c.recommendation_role,
          certificate_template_url: c.certificate_template_url,
          recommendation_template_url: c.recommendation_template_url,
          signature_name: c.signature_name,
          signature_role: c.signature_role,
          status: c.status,
          is_featured: c.is_featured,
          sort_order: c.sort_order,
        })
        .eq("id", c.id);
      if (!error) {
        setSavedAt(new Date().toLocaleTimeString("pt-BR"));
        router.refresh();
      }
    });
  }

  async function addModule() {
    const sb = createSupabaseBrowserClient();
    const sort = (mods.at(-1)?.sort_order ?? 0) + 10;
    const { data } = await sb
      .from("modules")
      .insert({ course_id: c.id, title: `Módulo ${mods.length + 1}`, sort_order: sort })
      .select("*")
      .single();
    if (data) setMods([...mods, { ...(data as Module), lessons: [] }]);
  }

  async function updateModule(m: Module, patch: Partial<Module>) {
    const sb = createSupabaseBrowserClient();
    await sb.from("modules").update(patch).eq("id", m.id);
    setMods(mods.map((x) => (x.id === m.id ? { ...x, ...patch } : x)));
  }

  async function deleteModule(m: Module) {
    if (!confirm(`Excluir o módulo "${m.title}" e todas as aulas?`)) return;
    const sb = createSupabaseBrowserClient();
    await sb.from("modules").delete().eq("id", m.id);
    setMods(mods.filter((x) => x.id !== m.id));
  }

  async function addLesson(m: ModuleWithLessons) {
    const sb = createSupabaseBrowserClient();
    const sort = (m.lessons.at(-1)?.sort_order ?? 0) + 10;
    const { data } = await sb
      .from("lessons")
      .insert({
        module_id: m.id,
        title: `Aula ${m.lessons.length + 1}`,
        panda_video_id: "",
        duration_seconds: 0,
        sort_order: sort,
      })
      .select("*")
      .single();
    if (data) {
      setMods(
        mods.map((x) =>
          x.id === m.id ? { ...x, lessons: [...x.lessons, data as Lesson] } : x,
        ),
      );
    }
  }

  async function updateLesson(l: Lesson, patch: Partial<Lesson>) {
    const sb = createSupabaseBrowserClient();
    await sb.from("lessons").update(patch).eq("id", l.id);
    setMods(
      mods.map((m) => ({
        ...m,
        lessons: m.lessons.map((x) => (x.id === l.id ? { ...x, ...patch } : x)),
      })),
    );
  }

  async function deleteLesson(l: Lesson) {
    if (!confirm(`Excluir a aula "${l.title}"?`)) return;
    const sb = createSupabaseBrowserClient();
    await sb.from("lessons").delete().eq("id", l.id);
    setMods(mods.map((m) => ({ ...m, lessons: m.lessons.filter((x) => x.id !== l.id) })));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{c.title}</h1>
          <p className="text-sm text-muted">/{c.slug}</p>
        </div>
        <button
          onClick={saveCourse}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold hover:bg-brand-light disabled:opacity-60"
        >
          <Save size={14} /> {pending ? "Salvando..." : savedAt ? `Salvo às ${savedAt}` : "Salvar"}
        </button>
      </div>

      <section className="grid gap-4 rounded-xl border border-white/5 bg-bg-card p-5 md:grid-cols-2">
        <Field label="Título">
          <input
            value={c.title}
            onChange={(e) => set("title", e.target.value)}
            className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Subtítulo">
          <input
            value={c.subtitle ?? ""}
            onChange={(e) => set("subtitle", e.target.value)}
            className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Categoria">
          <select
            value={c.category_id ?? ""}
            onChange={(e) => set("category_id", e.target.value || null)}
            className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 text-sm"
          >
            <option value="">— sem categoria —</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Acesso">
          <select
            value={c.access_type}
            onChange={(e) => set("access_type", e.target.value as "free" | "paid")}
            className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 text-sm"
          >
            <option value="paid">Pago (libera por matrícula/webhook)</option>
            <option value="free">Gratuito (todos os cadastrados acessam)</option>
          </select>
        </Field>
        {c.access_type === "paid" && (
          <>
            <Field label="URL da página de vendas">
              <input
                value={c.sales_url ?? ""}
                onChange={(e) => set("sales_url", e.target.value)}
                placeholder="https://..."
                className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="URL do WhatsApp (alternativa)">
              <input
                value={c.whatsapp_url ?? ""}
                onChange={(e) => set("whatsapp_url", e.target.value)}
                placeholder="https://wa.me/55..."
                className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 text-sm"
              />
            </Field>
          </>
        )}
        <Field label="Thumbnail (capa do card)">
          <FileUpload
            folder={`courses/${c.id}/thumb`}
            value={c.thumbnail_url}
            onChange={(url) => set("thumbnail_url", url)}
            label="Enviar thumbnail"
            hint="JPG ou PNG, recomendado 16:9 (1280×720)"
          />
        </Field>
        <Field label="Banner (topo do curso/Hero)">
          <FileUpload
            folder={`courses/${c.id}/banner`}
            value={c.banner_url}
            onChange={(url) => set("banner_url", url)}
            label="Enviar banner"
            hint="JPG ou PNG, recomendado 1920×1080"
          />
        </Field>
        <Field label="Descrição (markdown)" className="md:col-span-2">
          <textarea
            rows={4}
            value={c.description_md ?? ""}
            onChange={(e) => set("description_md", e.target.value)}
            className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Conteúdo programático (markdown — vai no verso do certificado)" className="md:col-span-2">
          <textarea
            rows={6}
            value={c.syllabus_md ?? ""}
            onChange={(e) => set("syllabus_md", e.target.value)}
            placeholder={"## Módulo 1\n- Tópico 1\n- Tópico 2"}
            className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 text-sm"
          />
        </Field>
        <Field label='Cargo/função usado na Carta de Recomendação (ex.: "Auxiliar de Veterinário")' className="md:col-span-2">
          <input
            value={c.recommendation_role ?? ""}
            onChange={(e) => set("recommendation_role", e.target.value)}
            placeholder="Se vazio, usa o título do curso"
            className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Modelo do CERTIFICADO (frente — imagem)">
          <FileUpload
            folder={`courses/${c.id}/certificate`}
            value={c.certificate_template_url}
            onChange={(url) => set("certificate_template_url", url)}
            label="Enviar arte do certificado"
            hint="PNG ou JPG paisagem (recomendado 2000×1414). Os campos #NOME, #CPF, #CURSO e #DATA são impressos por cima automaticamente."
          />
        </Field>
        <Field label="Modelo da CARTA DE RECOMENDAÇÃO (imagem)">
          <FileUpload
            folder={`courses/${c.id}/letter`}
            value={c.recommendation_template_url}
            onChange={(url) => set("recommendation_template_url", url)}
            label="Enviar arte da carta"
            hint="PNG ou JPG retrato (recomendado 1414×2000). Se vazio, usamos um modelo padrão com o texto oficial."
          />
        </Field>
        <Field label="Status">
          <select
            value={c.status}
            onChange={(e) => set("status", e.target.value as "draft" | "published")}
            className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 text-sm"
          >
            <option value="draft">Rascunho</option>
            <option value="published">Publicado</option>
          </select>
        </Field>
        <Field label="Em destaque (Hero da home)">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={c.is_featured}
              onChange={(e) => set("is_featured", e.target.checked)}
            />
            Mostrar como destaque
          </label>
        </Field>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Módulos e aulas</h2>
          <button
            onClick={addModule}
            className="inline-flex items-center gap-1 rounded-md bg-bg-hover px-3 py-1.5 text-xs hover:text-white"
          >
            <Plus size={12} /> Novo módulo
          </button>
        </div>
        <div className="space-y-3">
          {mods.map((m, mi) => (
            <details key={m.id} open className="rounded-lg border border-white/5 bg-bg p-3">
              <summary className="flex cursor-pointer items-center justify-between">
                <input
                  defaultValue={m.title}
                  onBlur={(e) =>
                    e.target.value !== m.title && updateModule(m, { title: e.target.value })
                  }
                  className="rounded-md bg-transparent px-2 py-1 font-semibold focus:bg-bg-card"
                />
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>{m.lessons.length} aula(s)</span>
                  <button
                    onClick={() => deleteModule(m)}
                    className="hover:text-red-400"
                    title="Excluir módulo"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </summary>
              <ul className="mt-3 space-y-2">
                {m.lessons.map((l) => (
                  <li key={l.id} className="grid grid-cols-[1fr_180px_120px_36px] items-center gap-2 text-sm">
                    <input
                      defaultValue={l.title}
                      onBlur={(e) =>
                        e.target.value !== l.title && updateLesson(l, { title: e.target.value })
                      }
                      placeholder="Título da aula"
                      className="rounded-md border border-white/10 bg-bg-card px-3 py-1.5"
                    />
                    <input
                      defaultValue={l.panda_video_id ?? ""}
                      onBlur={(e) =>
                        e.target.value !== (l.panda_video_id ?? "") &&
                        updateLesson(l, { panda_video_id: e.target.value })
                      }
                      placeholder="Panda video ID"
                      className="rounded-md border border-white/10 bg-bg-card px-3 py-1.5"
                    />
                    <input
                      type="number"
                      defaultValue={l.duration_seconds}
                      min={0}
                      onBlur={(e) =>
                        Number(e.target.value) !== l.duration_seconds &&
                        updateLesson(l, { duration_seconds: Number(e.target.value) })
                      }
                      placeholder="Duração (s)"
                      className="rounded-md border border-white/10 bg-bg-card px-3 py-1.5"
                    />
                    <button
                      onClick={() => deleteLesson(l)}
                      className="text-muted hover:text-red-400"
                      title="Excluir aula"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => addLesson(m)}
                className="mt-3 inline-flex items-center gap-1 rounded-md bg-bg-hover px-3 py-1 text-xs text-muted hover:text-white"
              >
                <Plus size={12} /> Adicionar aula
              </button>
              {mi === mods.length - 1 && null}
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={"block text-xs uppercase tracking-wider text-muted " + (className ?? "")}>
      <span>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
