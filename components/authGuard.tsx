"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/lib/useMe";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { me, loading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [loading, me, router]);

  if (loading) return <div className="p-6 text-zinc-300">Carregando...</div>;
  if (!me) return null;

  return <>{children}</>;
}
