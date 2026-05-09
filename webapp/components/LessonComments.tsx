"use client";

import { MessageSquareLock, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Comment {
  id: string;
  body: string;
  created_at: string;
  parent_id: string | null;
  user_id: string;
  status: "open" | "answered";
  answered_at: string | null;
}

export function LessonComments({ lessonId }: { lessonId: string }) {
  const [items, setItems] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function load() {
    const sb = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return;
    // RLS already filters to: own threads + replies to them
    const { data } = await sb
      .from("comments")
      .select("id, body, created_at, parent_id, user_id, status, answered_at")
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true });
    setItems((data ?? []) as Comment[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    const sb = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      setSending(false);
      return;
    }
    await sb.from("comments").insert({
      lesson_id: lessonId,
      user_id: user.id,
      body: body.trim(),
    });
    setBody("");
    setSending(false);
    void load();
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2 text-sm text-muted">
        <MessageSquareLock size={16} />
        <span>
          Suas dúvidas vão direto para nossos professores.{" "}
          <strong className="text-white">Outros alunos não veem</strong> seus comentários.
        </span>
      </div>

      <div className="space-y-2">
        {loading && <p className="text-sm text-muted">Carregando...</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-muted">
            Você ainda não enviou perguntas para esta aula.
          </p>
        )}
        {items.map((c) => {
          const isReply = !!c.parent_id;
          return (
            <div
              key={c.id}
              className={
                "rounded-lg border p-3 text-sm " +
                (isReply
                  ? "ml-6 border-emerald-700/30 bg-emerald-900/10"
                  : "border-white/5 bg-bg-card")
              }
            >
              <div className="mb-1 flex items-center justify-between text-xs text-muted">
                <span>{isReply ? "Resposta do suporte" : "Você"}</span>
                <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <p className="whitespace-pre-wrap">{c.body}</p>
              {!isReply && c.status === "answered" && (
                <span className="mt-1 inline-block text-[11px] text-emerald-300">
                  ✓ respondido
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Tirar uma dúvida com nosso suporte..."
          className="flex-1 rounded-md border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          onClick={send}
          disabled={sending || !body.trim()}
          className="rounded-md bg-brand p-2 hover:bg-brand-light disabled:opacity-60"
          title="Enviar"
        >
          <Send size={16} />
        </button>
      </div>
    </section>
  );
}
