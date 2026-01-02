"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { signIn, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await signIn(email, password);
      router.push("/");
    } catch (e: any) {
      setError(e?.message ?? "Erro ao logar");
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
      <h1 className="text-xl font-semibold">Entrar</h1>

      <input
        className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2"
        placeholder="Senha"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <button
        disabled={loading}
        onClick={submit}
        className="w-full rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </div>
  );
}
