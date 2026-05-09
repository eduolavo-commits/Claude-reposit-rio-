import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildCertificatePdf } from "@/lib/certificate/pdf";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: cert } = await supabase
    .from("certificates")
    .select("id, user_id, course_id, type, full_name_snapshot, cpf_snapshot, last_issued_at, code")
    .eq("id", id)
    .maybeSingle();
  if (!cert) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (cert.user_id !== user.id) {
    // Allow staff to download
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!prof || (prof.role !== "admin" && prof.role !== "support"))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: course } = await supabase
    .from("courses")
    .select(
      "title, syllabus_md, recommendation_role, certificate_template_url, recommendation_template_url, signature_name, signature_role",
    )
    .eq("id", cert.course_id)
    .maybeSingle();
  if (!course) return NextResponse.json({ error: "course_not_found" }, { status: 404 });

  const verificationUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://area.agsclick.com.br") +
    "/verificar/" +
    cert.code;

  const pdf = await buildCertificatePdf({
    type: cert.type,
    fullName: cert.full_name_snapshot,
    cpf: cert.cpf_snapshot,
    courseTitle: course.title,
    recommendationRole: course.recommendation_role ?? null,
    syllabusMarkdown: course.syllabus_md,
    issuedAt: cert.last_issued_at,
    signatureName: course.signature_name,
    signatureRole: course.signature_role,
    verificationUrl,
    certificateTemplateUrl: course.certificate_template_url ?? null,
    recommendationTemplateUrl: course.recommendation_template_url ?? null,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="certificado-${cert.id}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
