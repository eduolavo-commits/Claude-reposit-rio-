import Link from "next/link";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span
        className="grid place-items-center rounded-full bg-brand text-white font-bold"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        A
      </span>
      <span className="font-semibold tracking-tight">
        AGS<span className="text-brand-accent">.</span>CLICK
        <span className="ml-1 text-xs font-normal text-muted">Treinamentos</span>
      </span>
    </Link>
  );
}
