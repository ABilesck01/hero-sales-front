"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/useMe";

type Item = {
  id: number;
  itemName: string;
  price: number | null;
};


type StockBalance = { item: number; balance: number };

type CartLine = {
  itemId: number;
  name: string;
  unitPrice: number; // preço editável no carrinho
  qty: number;
  stock: number; // estoque atual
};

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function SalesPage() {
  const current = useMe();

  const [items, setItems] = useState<Item[]>([]);
  const [balances, setBalances] = useState<Record<number, number>>({});

  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Carrega itens, saldo e usuários
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        // itens
        const it = await apiFetch<{ data: Item[] }>("/api/items");
        setItems(it.data);

        // saldos em paralelo
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
        setError(e?.message ?? "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.itemName.toLowerCase().includes(q));
  }, [items, query]);

  const total = useMemo(() => {
    return cart.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  }, [cart]);

  function addToCart(item: Item) {
    setError(null);
    setSuccess(null);

    const stock = balances[item.id] ?? 0;
    const defaultPrice = item.price ?? 0;

    setCart((prev) => {
      const idx = prev.findIndex((p) => p.itemId === item.id);
      if (idx >= 0) {
        const next = [...prev];
        const line = next[idx];

        if (line.qty + 1 > stock) {
          setError(`Estoque insuficiente para "${line.name}". Disponível: ${stock}`);
          return prev;
        }

        next[idx] = { ...line, qty: line.qty + 1, stock };
        return next;
      }

      if (stock <= 0) {
        setError(`Sem estoque para "${item.itemName}".`);
        return prev;
      }

      return [
        { itemId: item.id, name: item.itemName, qty: 1, unitPrice: defaultPrice, stock },
        ...prev,
      ];
    });
  }

  function updateQty(itemId: number, qty: number) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.itemId !== itemId) return l;

        const stock = balances[itemId] ?? l.stock ?? 0;
        const safeQty = Math.max(1, Math.floor(qty));

        if (safeQty > stock) {
          setError(`Estoque insuficiente para "${l.name}". Disponível: ${stock}`);
          return { ...l, qty: stock, stock };
        }

        return { ...l, qty: safeQty, stock };
      })
    );
  }

  function updatePrice(itemId: number, price: number) {
    setCart((prev) =>
      prev.map((l) => (l.itemId === itemId ? { ...l, unitPrice: Math.max(0, price) } : l))
    );
  }

  function removeLine(itemId: number) {
    setCart((prev) => prev.filter((l) => l.itemId !== itemId));
  }

  async function finalizeSale() {
    if (!current?.me?.authUserId) {
        setError("Selecione um usuário no topo para registrar a venda.");
        return;
        }
    setError(null);
    setSuccess(null);

    if (cart.length === 0) {
      setError("Adicione pelo menos 1 item ao carrinho.");
      return;
    }

    // validação final com saldos atuais
    for (const l of cart) {
      const stock = balances[l.itemId] ?? 0;
      if (l.qty > stock) {
        setError(`Estoque insuficiente para "${l.name}". Disponível: ${stock}`);
        return;
      }
    }

    setSaving(true);
    try {
      // body padrão
        const body = {
        seller: current.me?.authUserId,
        items: cart.map((l) => ({
            item: l.itemId,
            amount: l.qty,
            price: l.unitPrice,
        })),
    };

      await apiFetch("/api/selling", {
        method: "POST",
        body: JSON.stringify(body),
      });

      // Atualiza saldos localmente (baixa do estoque)
      setBalances((prev) => {
        const next = { ...prev };
        for (const l of cart) {
          next[l.itemId] = (next[l.itemId] ?? 0) - l.qty;
        }
        return next;
      });

      setCart([]);
      setSuccess("Venda registrada com sucesso ✅");
    } catch (e: any) {
      setError(e?.message ?? "Erro ao registrar venda");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendas</h1>
          <p className="text-sm text-zinc-400">
            Monte o carrinho e finalize. O sistema valida estoque antes de registrar.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">

          <div className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
            Vendedor: <span className="font-semibold text-zinc-100">{current?.me?.fullname ?? "—"}</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
            Total: <span className="font-semibold text-zinc-100">{money(total)}</span>
          </div>

          <button
            disabled={saving || loading}
            onClick={finalizeSale}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Finalizando..." : "Finalizar venda"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Itens */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-zinc-300">Produtos</div>
            <input
              className="w-72 rounded-xl border border-white/10 bg-zinc-900 px-4 py-2 text-sm outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-400/40"
              placeholder="Buscar item..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/40">
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-950 text-left text-xs uppercase tracking-wider text-zinc-500">
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Preço</th>
                    <th className="px-4 py-3">Estoque</th>
                    <th className="px-4 py-3 text-right"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading && (
                    <tr>
                      <td className="px-4 py-6 text-zinc-400" colSpan={4}>
                        Carregando...
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filteredItems.map((it) => {
                      const stock = balances[it.id] ?? 0;
                      const disabled = stock <= 0;
                      const low = stock > 0 && stock <= 5;

                      return (
                        <tr key={it.id} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-3">
                            <div className="font-medium text-zinc-100">{it.itemName}</div>
                            <div className="text-xs text-zinc-500">ID #{it.id}</div>
                          </td>
                          <td className="px-4 py-3 text-zinc-200">
                            {money(it.price ?? 0)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={[
                                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                                disabled
                                  ? "bg-zinc-800 text-zinc-300"
                                  : low
                                  ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/25"
                                  : "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20",
                              ].join(" ")}
                            >
                              {stock} un.
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              disabled={disabled}
                              onClick={() => addToCart(it)}
                              className="rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-zinc-100 ring-1 ring-white/10 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Adicionar
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                  {!loading && filteredItems.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-zinc-400" colSpan={4}>
                        Nenhum item encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Carrinho */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-zinc-300">Carrinho</div>
            <button
              onClick={() => {
                setCart([]);
                setError(null);
                setSuccess(null);
              }}
              className="rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-zinc-100 ring-1 ring-white/10 hover:bg-white/10"
            >
              Limpar
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
            {cart.length === 0 ? (
              <div className="text-sm text-zinc-400">
                Adicione itens para começar a venda.
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((l) => (
                  <div
                    key={l.itemId}
                    className="rounded-xl border border-white/10 bg-zinc-950 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-zinc-100">{l.name}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Estoque: {balances[l.itemId] ?? l.stock} un.
                        </div>
                      </div>

                      <button
                        onClick={() => removeLine(l.itemId)}
                        className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                        title="Remover"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-xs text-zinc-400">Qtd</div>
                        <input
                          type="number"
                          min={1}
                          value={l.qty}
                          onChange={(e) => updateQty(l.itemId, Number(e.target.value))}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40"
                        />
                      </div>

                      <div>
                        <div className="text-xs text-zinc-400">Preço</div>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.unitPrice}
                          onChange={(e) => updatePrice(l.itemId, Number(e.target.value))}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40"
                        />
                      </div>

                      <div>
                        <div className="text-xs text-zinc-400">Subtotal</div>
                        <div className="mt-1 rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm text-zinc-100">
                          {money(l.qty * l.unitPrice)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-950 px-3 py-3">
                  <div className="text-sm text-zinc-300">Total</div>
                  <div className="text-base font-semibold text-zinc-100">{money(total)}</div>
                </div>
              </div>
            )}
          </div>

          <div className="text-xs text-zinc-500">
            Dica: o preço do carrinho pode ser ajustado antes de finalizar.
          </div>
        </div>
      </div>
    </div>
  );
}
