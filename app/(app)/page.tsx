"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/useMe";

type Item = {
  id: number;
  itemName: string;
  price: number | null;
};

type StockBalance = { item: number; balance: number };

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function DashboardPage() {
  const { me, loading: meLoading } = useMe();

  const [items, setItems] = useState<Item[]>([]);
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const LOW_STOCK_THRESHOLD = 5;

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const it = await apiFetch<{ data: Item[] }>("/api/items");
        setItems(it.data);

        const results = await Promise.all(
          it.data.map(async (x) => {
            try {
              const b = await apiFetch<StockBalance>(`/api/stock/${x.id}`);
              return [x.id, b.balance] as const;
            } catch {
              return [x.id, 0] as const;
            }
          })
        );

        const map: Record<number, number> = {};
        for (const [id, bal] of results) map[id] = bal;
        setBalances(map);
      } catch (e: any) {
        setError(e?.message ?? "Erro ao carregar dashboard");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const stats = useMemo(() => {
    const totalItems = items.length;

    const totalUnits = items.reduce((sum, it) => sum + (balances[it.id] ?? 0), 0);

    const lowStockItems = items
      .map((it) => ({
        ...it,
        stock: balances[it.id] ?? 0,
      }))
      .filter((x) => x.stock > 0 && x.stock <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.stock - b.stock);

    const zeroStockItems = items
      .map((it) => ({ ...it, stock: balances[it.id] ?? 0 }))
      .filter((x) => x.stock === 0)
      .length;

    const inventoryValue = items.reduce((sum, it) => {
      const stock = balances[it.id] ?? 0;
      const price = it.price ?? 0;
      return sum + stock * price;
    }, 0);

    return { totalItems, totalUnits, lowStockItems, zeroStockItems, inventoryValue };
  }, [items, balances]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-400">
            Visão rápida do estoque e atalhos para operar o sistema.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
            Usuário:{" "}
            <span className="font-semibold text-zinc-100">
              {meLoading ? "—" : (me?.fullname ?? me?.email ?? "—")}
            </span>
          </div>

          <div className="flex gap-2">
            <Link
              href="/sales"
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Nova venda
            </Link>

            <Link
              href="/stock"
              className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-100 ring-1 ring-white/10 hover:bg-white/10"
            >
              Estoque
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Itens cadastrados" value={loading ? "—" : stats.totalItems} />
        <KpiCard title="Unidades em estoque" value={loading ? "—" : stats.totalUnits} />
        <KpiCard
          title="Estoque baixo"
          value={loading ? "—" : stats.lowStockItems.length}
          hint={`≤ ${LOW_STOCK_THRESHOLD} unidades`}
        />
        <KpiCard
          title="Valor estimado do estoque"
          value={loading ? "—" : money(stats.inventoryValue)}
        />
      </div>

      {/* Conteúdo principal */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Estoque baixo */}
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-zinc-900/40">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="text-sm font-medium text-zinc-200">
              Itens com estoque baixo
            </div>
            <Link
              href="/stock"
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Ver estoque →
            </Link>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="text-sm text-zinc-400">Carregando...</div>
            ) : stats.lowStockItems.length === 0 ? (
              <div className="text-sm text-zinc-400">
                Nenhum item com estoque baixo no momento.
              </div>
            ) : (
              <div className="space-y-2">
                {stats.lowStockItems.slice(0, 8).map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-950 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-100">
                        {it.itemName}
                      </div>
                      <div className="text-xs text-zinc-500">
                        Estoque: <span className="text-amber-200">{it.stock} un.</span> • Preço:{" "}
                        <span className="text-zinc-200">{it.price != null ? money(it.price) : "—"}</span>
                      </div>
                    </div>

                    <Link
                      href={`/stock?focus=${it.id}`}
                      className="rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-zinc-100 ring-1 ring-white/10 hover:bg-white/10"
                    >
                      Repor
                    </Link>
                  </div>
                ))}

                {stats.lowStockItems.length > 8 && (
                  <div className="pt-2 text-xs text-zinc-500">
                    + {stats.lowStockItems.length - 8} itens…
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Ações rápidas / Resumo */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
            <div className="text-sm font-medium text-zinc-200">Resumo</div>
            <div className="mt-3 space-y-2 text-sm text-zinc-300">
              <Row label="Sem estoque" value={loading ? "—" : stats.zeroStockItems} />
              <Row
                label="Itens com preço definido"
                value={
                  loading ? "—" : items.filter((i) => (i.price ?? 0) > 0).length
                }
              />
              <Row
                label="Itens com estoque"
                value={
                  loading
                    ? "—"
                    : items.filter((i) => (balances[i.id] ?? 0) > 0).length
                }
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
            <div className="text-sm font-medium text-zinc-200">Atalhos</div>

            <div className="mt-3 grid gap-2">
              <Link
                href="/sales"
                className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
              >
                Registrar venda
              </Link>
              <Link
                href="/stock"
                className="rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-100 ring-1 ring-white/10 hover:bg-white/10"
              >
                Movimentar estoque
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: any;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-zinc-100">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-zinc-400">{label}</div>
      <div className="font-medium text-zinc-100">{value}</div>
    </div>
  );
}
