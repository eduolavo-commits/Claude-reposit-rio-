import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WebhooksAdmin } from "@/components/WebhooksAdmin";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const sb = await createSupabaseServerClient();
  const [{ data: courses }, { data: mappings }, { data: events }] = await Promise.all([
    sb.from("courses").select("id, title").order("title"),
    sb.from("product_mappings").select("*").order("provider"),
    sb
      .from("webhook_events")
      .select("id, provider, processed_at, error, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Webhooks de pagamento</h1>
      <WebhooksAdmin
        courses={courses ?? []}
        mappings={mappings ?? []}
        events={events ?? []}
      />
    </div>
  );
}
