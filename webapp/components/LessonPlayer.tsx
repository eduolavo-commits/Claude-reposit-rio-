"use client";

import { Check, CheckCircle2 } from "lucide-react";
import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  videoId: string | null;
  lessonId: string;
  completed: boolean;
}

export function LessonPlayer({ videoId, lessonId, completed: initialCompleted }: Props) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [pending, start] = useTransition();
  const lib = process.env.NEXT_PUBLIC_PANDA_LIBRARY_ID ?? "";

  const embedUrl = videoId
    ? `https://player-${lib}.tv.pandavideo.com.br/embed/?v=${encodeURIComponent(videoId)}`
    : null;

  function toggle() {
    start(async () => {
      const sb = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return;
      if (!completed) {
        await sb.from("lesson_progress").upsert({
          user_id: user.id,
          lesson_id: lessonId,
        });
      } else {
        await sb
          .from("lesson_progress")
          .delete()
          .eq("user_id", user.id)
          .eq("lesson_id", lessonId);
      }
      setCompleted(!completed);
    });
  }

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-sm text-muted">
            Vídeo ainda não disponível
          </div>
        )}
      </div>

      <button
        onClick={toggle}
        disabled={pending}
        className={
          "mt-3 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition " +
          (completed
            ? "bg-emerald-700 hover:bg-emerald-800"
            : "bg-bg-card hover:bg-bg-hover")
        }
      >
        {completed ? <CheckCircle2 size={16} /> : <Check size={16} />}
        {completed ? "Aula concluída" : "Marcar como concluída"}
      </button>
    </div>
  );
}
