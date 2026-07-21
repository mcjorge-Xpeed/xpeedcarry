"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ProDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [payoutFullName, setPayoutFullName] = useState("");
  const [payoutBankName, setPayoutBankName] = useState("");
  const [payoutClabe, setPayoutClabe] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutSaved, setPayoutSaved] = useState(false);
  const [payoutUpdatedAt, setPayoutUpdatedAt] = useState<string | null>(null);
  const [games, setGames] = useState<{ id: string; name: string }[]>([]);
  const [myGameIds, setMyGameIds] = useState<Set<string>>(new Set());
  const [togglingGameId, setTogglingGameId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setUserId(user.id);

      const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (me?.role !== "pro" && me?.role !== "admin") {
        setIsPro(false);
        setLoading(false);
        return;
      }
      setIsPro(true);

      const { data } = await supabase
        .from("orders")
        .select("id, order_number, title, status, pro_accepted, pro_earnings, pro_payout_due_at, created_at, client:client_id(full_name)")
        .eq("pro_id", user.id)
        .order("created_at", { ascending: false });
      setOrders(data ?? []);

      const { data: payoutInfo } = await supabase
        .from("pro_payout_info")
        .select("full_name, bank_name, clabe, updated_at")
        .eq("id", user.id)
        .maybeSingle();
      if (payoutInfo) {
        setPayoutFullName(payoutInfo.full_name ?? "");
        setPayoutBankName(payoutInfo.bank_name ?? "");
        setPayoutClabe(payoutInfo.clabe ?? "");
        setPayoutUpdatedAt(payoutInfo.updated_at ?? null);
      }

      // Sin filtro de "active": queremos que el pro pueda marcar cualquier
      // juego del catálogo (incluso los que todavía no están publicados en
      // la home), así la cobertura del admin siempre coincide con lo que
      // el pro ve aquí.
      const { data: gamesData } = await supabase
        .from("games")
        .select("id, name")
        .order("name");
      setGames(gamesData ?? []);

      const { data: myGames } = await supabase.from("pro_games").select("game_id").eq("pro_id", user.id);
      setMyGameIds(new Set((myGames ?? []).map((g) => g.game_id)));

      setLoading(false);
    })();
  }, []);

  async function savePayoutInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSavingPayout(true);
    setPayoutSaved(false);
    const now = new Date().toISOString();
    await supabase.from("pro_payout_info").upsert({
      id: userId,
      full_name: payoutFullName,
      bank_name: payoutBankName,
      clabe: payoutClabe,
      updated_at: now,
    });
    setPayoutUpdatedAt(now);
    setSavingPayout(false);
    setPayoutSaved(true);
  }

  async function toggleGame(gameId: string) {
    if (!userId) return;
    setTogglingGameId(gameId);
    const has = myGameIds.has(gameId);
    if (has) {
      await supabase.from("pro_games").delete().eq("pro_id", userId).eq("game_id", gameId);
    } else {
      await supabase.from("pro_games").insert({ pro_id: userId, game_id: gameId });
    }
    setMyGameIds((prev) => {
      const next = new Set(prev);
      if (has) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
    setTogglingGameId(null);
  }

  if (loading) return <p className="text-center mt-20">Loading...</p>;

  if (isPro === false) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p>This page is for pros only.</p>
      </div>
    );
  }

  function statusLabel(o: any) {
    if (o.status === "pending_payment") {
      return o.pro_accepted ? "Accepted, waiting for payment" : "New offer, respond";
    }
    const labels: Record<string, string> = {
      paid: "Paid, starting soon",
      in_progress: "In progress",
      delivered: "Delivered, waiting for client",
      completed: "Completed, awaiting payout",
      pro_paid: "Paid out",
    };
    return labels[o.status] ?? o.status;
  }

  const onHold = orders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + (Number(o.pro_earnings) || 0), 0);
  const totalPaid = orders
    .filter((o) => o.status === "pro_paid")
    .reduce((sum, o) => sum + (Number(o.pro_earnings) || 0), 0);
  const nextPayoutDate = orders
    .filter((o) => o.status === "completed" && o.pro_payout_due_at)
    .map((o) => new Date(o.pro_payout_due_at).getTime())
    .sort((a, b) => a - b)[0];

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-2">My Orders</h1>
      <p className="text-gray-400 text-sm mb-6">
        Orders assigned to you. Pros are paid twice a month, on the 14th and the 28th.
      </p>

      <div className="card p-5 mb-8">
        <p className="text-gray-400 text-sm mb-1">🔒 On Hold</p>
        <p className="text-3xl font-bold text-accent2">${onHold.toFixed(2)}</p>
        <p className="text-xs text-gray-500 mt-1">
          {nextPayoutDate
            ? `Clears automatically on your next payout: ${new Date(nextPayoutDate).toLocaleDateString()}`
            : "Clears automatically on your next payout (14th or 28th)."}
        </p>
        {totalPaid > 0 && (
          <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-white/10">
            Total paid out so far: <span className="text-gray-300">${totalPaid.toFixed(2)}</span>
          </p>
        )}
      </div>

      <div className="card p-5 mb-8">
        <h2 className="font-semibold mb-1">Payment details</h2>
        <p className="text-xs text-gray-500 mb-3">
          Only visible to admin, used to transfer your payouts. Not shared with anyone else.
        </p>
        <form onSubmit={savePayoutInfo} className="flex flex-col gap-2 max-w-sm">
          <input
            type="text"
            placeholder="Full name (as it appears on your bank account)"
            className="input"
            value={payoutFullName}
            onChange={(e) => setPayoutFullName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Bank name"
            className="input"
            value={payoutBankName}
            onChange={(e) => setPayoutBankName(e.target.value)}
          />
          <input
            type="text"
            placeholder="CLABE (18 digits)"
            maxLength={18}
            className="input"
            value={payoutClabe}
            onChange={(e) => setPayoutClabe(e.target.value.replace(/\D/g, ""))}
          />
          <button className="btn-primary text-sm" disabled={savingPayout}>
            {savingPayout ? "Saving..." : "Save Payment Details"}
          </button>
          {payoutSaved && <p className="text-accent2 text-xs">✅ Saved.</p>}
          {payoutUpdatedAt && (
            <p className="text-xs text-gray-500">
              Last updated: {new Date(payoutUpdatedAt).toLocaleString()}
            </p>
          )}
        </form>
      </div>

      <div className="card p-5 mb-8">
        <h2 className="font-semibold mb-1">Games I can boost</h2>
        <p className="text-xs text-gray-500 mb-3">
          Keep this up to date, it's how support knows who to offer new orders to.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {games.map((g) => (
            <label
              key={g.id}
              className={`flex items-center gap-2 text-sm px-3 py-2 rounded border cursor-pointer transition ${
                myGameIds.has(g.id) ? "border-accent text-accent bg-accent/10" : "border-white/10 text-gray-400"
              }`}
            >
              <input
                type="checkbox"
                className="accent-[#8b5cf6]"
                checked={myGameIds.has(g.id)}
                disabled={togglingGameId === g.id}
                onChange={() => toggleGame(g.id)}
              />
              {g.name}
            </label>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="text-gray-500">No orders assigned to you yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/pro/orders/${o.id}`}
              className="card p-5 flex items-center justify-between hover:border-accent transition"
            >
              <div>
                <p className="text-sm text-gray-400">{o.order_number}</p>
                <h2 className="font-semibold">{o.title}</h2>
                <p className="text-xs text-gray-500 mt-1">Client: {o.client?.full_name ?? "-"}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-accent2">${Number(o.pro_earnings ?? 0).toFixed(2)}</p>
                <p className="text-xs text-gray-400">{statusLabel(o)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
