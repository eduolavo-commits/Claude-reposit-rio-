import { Topbar } from "@/components/Topbar";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-16">
      <Topbar />
      <main className="pt-2">{children}</main>
    </div>
  );
}
