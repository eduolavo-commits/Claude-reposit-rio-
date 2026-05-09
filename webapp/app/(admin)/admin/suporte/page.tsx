import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupportInbox } from "@/components/SupportInbox";

export const dynamic = "force-dynamic";

interface ThreadRow {
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

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status === "answered" ? "answered" : "open";
  const sb = await createSupabaseServerClient();

  const { data } = await sb
    .from("comments")
    .select(
      `id, body, created_at, status, user_id, lesson_id,
       lesson:lessons!inner(title, module:modules!inner(course:courses!inner(slug,title))),
       author:profiles!comments_user_id_fkey(full_name),
       replies:comments!parent_id(id, body, created_at)`,
    )
    .is("parent_id", null)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  const threads = (data ?? []) as unknown as ThreadRow[];

  return <SupportInbox threads={threads} status={status} />;
}
