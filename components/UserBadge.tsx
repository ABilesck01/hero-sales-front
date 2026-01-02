"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export function UserBadge() {
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex items-center gap-2">
      <div className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
        {email ?? "—"}
      </div>
      <button
        onClick={logout}
        className="rounded-xl bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 ring-1 ring-white/10 hover:bg-white/10"
      >
        Sair
      </button>
    </div>
  );
}
