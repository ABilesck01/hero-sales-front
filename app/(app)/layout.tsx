"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/authGuard";
import { UserBadge } from "@/components/UserBadge";
import { useMe } from "@/lib/useMe";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { me } = useMe();

  return (
    <AuthGuard>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400" />
            <div>
              <div className="text-sm font-semibold text-white">HERO Sales</div>
              <div className="text-xs text-zinc-400">Estoque e Vendas</div>
            </div>
          </div>

          <nav className="hidden items-center gap-2 text-sm text-zinc-300 md:flex">
            <Link className="rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white" href="/">Dashboard</Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white" href="/sales">Vendas</Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white" href="/stock">Estoque</Link>
            {me?.isAdmin && (
              <Link className="rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white" href="/users">Usuários</Link>
            )}
          </nav>

          <UserBadge />
        </div>
      </header>

      {/* ✅ AQUI é onde a “borda da tela” se resolve */}
      <main className="flex justify-center px-6 py-8">
        <div className="w-full max-w-6xl">
          {children}
        </div>
      </main>
    </AuthGuard>
  );
}
