"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        const sb = createSupabaseBrowserClient();
        await sb.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="rounded-md p-1.5 text-muted hover:bg-bg-hover hover:text-white"
      title="Sair"
    >
      <LogOut size={16} />
    </button>
  );
}
