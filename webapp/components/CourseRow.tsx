"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { CourseCard } from "./CourseCard";
import type { Course } from "@/lib/supabase/types";

interface Props {
  title: string;
  subtitle?: string;
  courses: (Course & { _locked?: boolean })[];
}

export function CourseRow({ title, subtitle, courses }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  if (!courses.length) return null;

  const scroll = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * 600, behavior: "smooth" });
  };

  return (
    <section className="relative animate-fadeIn">
      <div className="mx-auto flex max-w-7xl items-end justify-between px-4 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="hidden gap-1 sm:flex">
          <button
            onClick={() => scroll(-1)}
            className="rounded-full bg-bg-card p-1.5 text-muted hover:bg-bg-hover hover:text-white"
            aria-label="Anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => scroll(1)}
            className="rounded-full bg-bg-card p-1.5 text-muted hover:bg-bg-hover hover:text-white"
            aria-label="Próximo"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="no-scrollbar mt-3 flex snap-x gap-3 overflow-x-auto scroll-smooth px-4 pb-6 sm:px-6"
      >
        {courses.map((c) => (
          <div key={c.id} className="snap-start">
            <CourseCard course={c} locked={c._locked} />
          </div>
        ))}
      </div>
    </section>
  );
}
