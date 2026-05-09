import Image from "next/image";
import Link from "next/link";
import { PlayCircle, Lock } from "lucide-react";
import type { Course } from "@/lib/supabase/types";

export function HeroBanner({
  course,
  locked,
}: {
  course: Course;
  locked: boolean;
}) {
  const target = locked
    ? course.sales_url ?? course.whatsapp_url ?? "#"
    : `/cursos/${course.slug}`;
  const isExternal = locked && (course.sales_url || course.whatsapp_url);

  const cta = (
    <span className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold hover:bg-brand-light">
      {locked ? <Lock size={16} /> : <PlayCircle size={18} />}
      {locked ? "Quero adquirir" : "Continuar curso"}
    </span>
  );

  return (
    <section className="relative isolate overflow-hidden">
      <div className="relative h-[42vh] min-h-[280px] w-full sm:h-[55vh]">
        {course.banner_url || course.thumbnail_url ? (
          <Image
            src={course.banner_url ?? course.thumbnail_url ?? "/placeholder-course.svg"}
            alt={course.title}
            fill
            priority
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand/40 to-bg" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
      </div>
      <div className="pointer-events-none absolute inset-0 mx-auto flex max-w-7xl items-end px-4 pb-8 sm:px-6 sm:pb-12">
        <div className="pointer-events-auto max-w-xl">
          {course.access_type === "free" && (
            <span className="mb-2 inline-block rounded bg-emerald-500/90 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider">
              Gratuito
            </span>
          )}
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">{course.title}</h1>
          {course.subtitle && (
            <p className="mt-2 line-clamp-3 text-sm text-white/80 sm:text-base">{course.subtitle}</p>
          )}
          <div className="mt-4">
            {isExternal ? (
              <a href={target} target="_blank" rel="noopener noreferrer">
                {cta}
              </a>
            ) : (
              <Link href={target}>{cta}</Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
