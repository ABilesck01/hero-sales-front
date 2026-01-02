"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/useMe";

type Item = {
  id: number;
  itemName: string;
  price: number | null;
  isActive?: boolean;
};

type StockBalance = { item: number; balance: number };

function money(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function StockPage() {

  const { me: user, loading: meLoading } = useMe();

  const [items, setItems] = useState<Item[]>([]);
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");

  // modal
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [qty, setQty] = useState<number>(0);
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // modal novo item
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState<string>("");
  const [creatingItem, setCreatingItem] = useState(false);


  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const itemsResp = await apiFetch<{ data: Item[] }>("/api/items");
        const active = itemsResp.data; // se seu GET já filtra ativo, ótimo
        setItems(active);

        // carrega saldos em paralelo (mais rápido)
        const results = await Promise.all(
          active.map(async (it) => {
            try {
              const b = await apiFetch<StockBalance>(`/api/stock/${it.id}`);
              return [it.id, b.balance] as const;
            } catch {
              return [it.id, 0] as const;
            }
          })
        );

        const map: Record<number, number> = {};
        for (const [id, bal] of results) map[id] = bal;
        setBalances(map);
      } catch (e: any) {
        setError(e?.message ?? "Erro ao carregar estoque");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.itemName.toLowerCase().includes(q));
  }, [items, query]);

  function openMove(it: Item) {
    setSelectedItem(it);
    setQty(0);
    setNote("");
    setError(null);
  }

  async function submitMovement() {
    if (!selectedItem) return;

    if (!Number.isInteger(qty) || qty === 0) {
      setError("Quantidade deve ser um inteiro diferente de zero.");
      return;
    }

    // regra simples: não-admin não pode lançar negativo
    if (!user?.isAdmin && qty < 0) {
      setError("Ajuste negativo permitido somente para admin.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiFetch("/api/stock", {
        method: "POST",
        body: JSON.stringify({
          item: selectedItem.id,
          qty,
          note: note || null,
        }),
      });

      setBalances((prev) => ({
        ...prev,
        [selectedItem.id]: (prev[selectedItem.id] ?? 0) + qty,
      }));

      setSelectedItem(null);
      setQty(0);
      setNote("");
    } catch (e: any) {
      setError(e?.message ?? "Erro ao salvar movimentação");
    } finally {
      setSaving(false);
    }
}


    async function createNewItem() {
    const name = newItemName.trim();
    if (!name) {
      setError("Nome do item é obrigatório.");
      return;
    }

    // aceita vazio => null
    const price =
      newItemPrice.trim() === "" ? null : Number(newItemPrice.replace(",", "."));

    if (price !== null && (Number.isNaN(price) || price < 0)) {
      setError("Preço inválido.");
      return;
    }

    setCreatingItem(true);
    setError(null);

    try {
      // se seu backend retorna { data: { ... } } ou só o item, ajusta abaixo.
      const resp = await apiFetch<{ data?: Item; item?: Item; id?: number; itemName?: string; price?: number | null }>(
        "/api/items",
        {
          method: "POST",
          body: JSON.stringify({ itemName: name, price }),
        }
      );

      const created: Item =
        (resp as any).data ?? (resp as any).item ?? {
          id: (resp as any).id,
          itemName: (resp as any).itemName,
          price: (resp as any).price ?? price,
        };

      // adiciona no topo
      setItems((prev) => [created, ...prev]);
      setBalances((prev) => ({ ...prev, [created.id]: 0 }));

      setNewItemOpen(false);
      setNewItemName("");
      setNewItemPrice("");
    } catch (e: any) {
      setError(e?.message ?? "Erro ao criar item");
    } finally {
      setCreatingItem(false);
    }
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Estoque</h1>
          <p className="text-sm text-zinc-400">
            Lista de produtos com preço e quantidade atual. Movimente sem sair da tela.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <button
                onClick={() => {
                setError(null);
                setNewItemOpen(true);
                }}
                className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
                + Novo item
            </button>

            <input
                className="w-72 rounded-xl border border-white/10 bg-zinc-900 px-4 py-2 text-sm outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-400/40"
                placeholder="Buscar item..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-zinc-900/40 shadow-sm">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="text-sm text-zinc-300">
            {loading ? "Carregando..." : `${filtered.length} itens`}
          </div>
          <div className="text-xs text-zinc-500">
            Dica: estoque baixo fica destacado
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Estoque</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {!loading &&
                filtered.map((it) => {
                  const bal = balances[it.id] ?? 0;
                  const low = bal > 0 && bal <= 5;
                  const zero = bal === 0;

                  return (
                    <tr key={it.id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-100">{it.itemName}</div>
                        <div className="text-xs text-zinc-500">ID #{it.id}</div>
                      </td>

                      <td className="px-4 py-3 text-zinc-200">{money(it.price)}</td>

                      <td className="px-4 py-3">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                            zero
                              ? "bg-zinc-800 text-zinc-300"
                              : low
                              ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/25"
                              : "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20",
                          ].join(" ")}
                        >
                          {bal} un.
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openMove(it)}
                          className="rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-zinc-100 ring-1 ring-white/10 hover:bg-white/10"
                        >
                          Movimentar
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {loading && (
                <tr>
                  <td className="px-4 py-6 text-zinc-400" colSpan={4}>
                    Carregando itens e saldos...
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
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

      {/* Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">{selectedItem.itemName}</div>
                <div className="mt-1 text-xs text-zinc-400">
                  Estoque atual: <span className="text-zinc-200">{balances[selectedItem.id] ?? 0} un.</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-zinc-400">Quantidade</label>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40"
                  placeholder="+ entrada / - ajuste"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  {user?.isAdmin
                    ? "Admin pode usar negativo para ajuste."
                    : "Operador: use apenas valores positivos."}
                </p>
              </div>

              <div>
                <label className="text-xs text-zinc-400">Observação</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40"
                  placeholder="Ex: Compra, reposição, perda..."
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="mt-2 flex gap-2">
                <button
                  disabled={saving}
                  onClick={submitMovement}
                  className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>

                <button
                  disabled={saving}
                  onClick={() => setSelectedItem(null)}
                  className="rounded-xl bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {newItemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-xl">
            <div className="flex items-start justify-between">
                <div>
                <div className="text-lg font-semibold">Novo item</div>
                <div className="mt-1 text-xs text-zinc-400">
                    Crie um produto novo para começar a controlar estoque.
                </div>
                </div>

                <button
                onClick={() => setNewItemOpen(false)}
                className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                >
                ✕
                </button>
            </div>

            <div className="mt-4 space-y-3">
                <div>
                <label className="text-xs text-zinc-400">Nome do item</label>
                <input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40"
                    placeholder="Ex: Coca-Cola 2L"
                />
                </div>

                <div>
                <label className="text-xs text-zinc-400">Preço (opcional)</label>
                <input
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40"
                    placeholder="Ex: 9.90"
                />
                </div>

                {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {error}
                </div>
                )}

                <div className="mt-2 flex gap-2">
                <button
                    disabled={creatingItem}
                    onClick={createNewItem}
                    className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                    {creatingItem ? "Criando..." : "Criar item"}
                </button>

                <button
                    disabled={creatingItem}
                    onClick={() => setNewItemOpen(false)}
                    className="rounded-xl bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-60"
                >
                    Cancelar
                </button>
                </div>
            </div>
            </div>
        </div>
        )}

    </div>
  );
}
