import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ProviderAdapter } from "@/lib/webhook/types";
import { hotmartAdapter } from "@/lib/webhook/hotmart";
import { kiwifyAdapter } from "@/lib/webhook/kiwify";
import { eduzzAdapter } from "@/lib/webhook/eduzz";
import { cademiAdapter } from "@/lib/webhook/cademi";

export const runtime = "nodejs";

const ADAPTERS: Record<string, ProviderAdapter> = {
  hotmart: hotmartAdapter,
  kiwify: kiwifyAdapter,
  eduzz: eduzzAdapter,
  cademi: cademiAdapter,
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const adapter = ADAPTERS[provider];
  if (!adapter) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });

  const sb = createSupabaseAdminClient();
  const raw = await req.json().catch(() => ({}));

  // Always log raw event first for auditing
  const { data: logRow } = await sb
    .from("webhook_events")
    .insert({ provider, raw })
    .select("id")
    .single();
  const logId = logRow?.id;

  let events;
  try {
    events = await adapter.parse(req, raw);
  } catch (e) {
    await sb.from("webhook_events").update({ error: String(e) }).eq("id", logId);
    return NextResponse.json({ error: "parse_failed" }, { status: 400 });
  }
  if (!events || events.length === 0) {
    await sb.from("webhook_events").update({ processed_at: new Date().toISOString(), error: "ignored_or_unauth" }).eq("id", logId);
    return NextResponse.json({ ok: true, ignored: true });
  }

  const errors: string[] = [];
  for (const ev of events) {
    try {
      // Resolve course
      const { data: mapping } = await sb
        .from("product_mappings")
        .select("course_id")
        .eq("provider", provider)
        .eq("external_product_id", ev.external_product_id)
        .maybeSingle();
      if (!mapping?.course_id) {
        errors.push(`no mapping for product ${ev.external_product_id}`);
        continue;
      }

      // Find or create user via Supabase Auth Admin (lookup by email)
      let userId: string | null = null;
      const emailLower = ev.email.toLowerCase();
      const { data: list } = await sb.auth.admin.listUsers();
      const found = list.users.find((u) => u.email?.toLowerCase() === emailLower);
      if (found) {
        userId = found.id;
      } else {
        const { data: created, error } = await sb.auth.admin.createUser({
          email: ev.email,
          email_confirm: true,
          user_metadata: { full_name: ev.full_name ?? "" },
        });
        if (error) throw error;
        userId = created?.user?.id ?? null;
      }
      if (!userId) {
        errors.push(`unable to resolve user for ${ev.email}`);
        continue;
      }

      if (ev.action === "grant") {
        await sb.from("enrollments").upsert(
          {
            user_id: userId,
            course_id: mapping.course_id,
            status: "active",
            source: provider,
            external_order_id: ev.external_order_id,
            granted_at: new Date().toISOString(),
          },
          { onConflict: "user_id,course_id" },
        );
        if (ev.full_name || ev.cpf) {
          await sb
            .from("profiles")
            .update({
              ...(ev.full_name ? { full_name: ev.full_name } : {}),
              ...(ev.cpf ? { cpf: ev.cpf } : {}),
            })
            .eq("user_id", userId);
        }
      } else {
        await sb
          .from("enrollments")
          .update({ status: "revoked" })
          .eq("user_id", userId)
          .eq("course_id", mapping.course_id);
      }
    } catch (e) {
      errors.push(String(e));
    }
  }

  await sb
    .from("webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      error: errors.length ? errors.join(" | ") : null,
    })
    .eq("id", logId);

  return NextResponse.json({ ok: true, processed: events.length, errors });
}
