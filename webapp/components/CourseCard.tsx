import Link from "next/link";
import Image from "next/image";
import { Lock, PlayCircle } from "lucide-react";
import type { Course } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface Props {
  course: Pick<
    Course,
    "slug" | "title" | "subtitle" | "thumbnail_url" | "access_type" | "sales_url" | "whatsapp_url"
  >;
  locked?: boolean;
}

export function CourseCard({ course, locked }: Props) {
  const placeholder = "/placeholder-course.svg";
  const thumb = course.thumbnail_url ?? placeholder;
  const target = locked ? course.sales_url ?? course.whatsapp_url ?? "#" : `/cursos/${course.slug}`;
  const isExternal = locked && (course.sales_url || course.whatsapp_url);

  const inner = (
    <div className="card-hover group relative aspect-video w-64 shrink-0 overflow-hidden rounded-lg bg-bg-card shadow-glow">
      <Image
        src={thumb}
        alt={course.title}
        fill
        sizes="256px"
        className={cn("object-cover transition-opacity", locked && "opacity-60")}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
      {course.access_type === "free" && !locked && (
        <span className="absolute left-2 top-2 rounded bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
          Grátis
        </span>
      )}
      {locked && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-1 rounded-full bg-black/55 p-3 backdrop-blur">
            <Lock size={22} />
            <span className="text-[10px] uppercase tracking-wider">Adquirir</span>
          </div>
        </div>
      )}
      {!locked && (
        <PlayCircle
          className="absolute right-2 top-2 text-white/80 opacity-0 transition group-hover:opacity-100"
          size={26}
        />
      )}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{course.title}</h3>
        {course.subtitle && (
          <p className="mt-0.5 line-clamp-1 text-xs text-white/70">{course.subtitle}</p>
        )}
      </div>
    </div>
  );

  if (isExternal) {
    return (
      <a href={target!} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return <Link href={target}>{inner}</Link>;
}
