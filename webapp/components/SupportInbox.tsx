"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Send } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Thread {
  id: string;
  body: string;
  created_at: string;
  status: "open" | "answered";
  user_id: string;
  lesson_id: string;
  lesson: { title: string; module: { course: { slug: string; title: string } } } | null;
  author: { full_name: string | null } | null;
  replies: { id: string; body: string; created_at: string }[];
}

export function SupportInbox({ threads, status }: { threads: Thread[]; status: string }) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inbox de suporte</h1>
        <div className="flex gap-2 text-sm">
          <Link
            href="/admin/suporte?status=open"
            className={
              "rounded-md px-3 py-1.5 " +
              (status === "open" ? "bg-brand text-white" : "bg-bg-card text-muted hover:bg-bg-hover")
            }
          >
            Abertas
          </Link>
          <Link
            href="/admin/suporte?status=answered"
            className={
              "rounded-md px-3 py-1.5 " +
              (status === "answered" ? "bg-brand text-white" : "bg-bg-card text-muted hover:bg-bg-hover")
            }
          >
            Respondidas
          </Link>
        </div>
      </div>

      {threads.length === 0 && (
        <p className="text-sm text-muted">Nenhuma dúvida {status === "open" ? "em aberto" : "respondida"}.</p>
      )}

      <div className="space-y-3">
        {threads.map((t) => (
          <ThreadCard key={t.id} thread={t} />
        ))}
      </div>
    </div>
  );
}

function ThreadCard({ thread }: { thread: Thread }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!reply.trim()) return;
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
      lesson_id: thread.lesson_id,
      user_id: user.id,
      parent_id: thread.id,
      body: reply.trim(),
    });
    await sb
      .from("comments")
      .update({ status: "answered", answered_by: user.id, answered_at: new Date().toISOString() })
      .eq("id", thread.id);
    setReply("");
    setSending(false);
    router.refresh();
  }

  return (
    <article className="rounded-xl border border-white/5 bg-bg-card p-4">
      <header className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>
          <strong className="text-white">{thread.author?.full_name ?? "Aluno"}</strong> ·{" "}
          {thread.lesson?.module.course.title} · {thread.lesson?.title}
        </span>
        <span>{new Date(thread.created_at).toLocaleString("pt-BR")}</span>
      </header>
      <p className="whitespace-pre-wrap text-sm">{thread.body}</p>

      {thread.replies.length > 0 && (
        <div className="mt-3 space-y-2 border-l-2 border-emerald-700/30 pl-3">
          {thread.replies.map((r) => (
            <div key={r.id} className="text-sm">
              <div className="text-[11px] text-muted">
                Suporte · {new Date(r.created_at).toLocaleString("pt-BR")}
              </div>
              <p className="whitespace-pre-wrap">{r.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={2}
          placeholder="Escrever resposta privada..."
          className="flex-1 rounded-md border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          onClick={send}
          disabled={sending || !reply.trim()}
          className="rounded-md bg-brand p-2 hover:bg-brand-light disabled:opacity-60"
          title="Responder"
        >
          <Send size={16} />
        </button>
      </div>
    </article>
  );
}
