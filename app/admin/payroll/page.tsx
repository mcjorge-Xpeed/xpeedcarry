"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";

type OrderRow = {
  id: string;
  order_number: string;
  pro_earnings: number;
  pro_payout_due_at: string;
  pro_id: string;
};

type PayoutInfo = { full_name: string | null; bank_name: string | null; clabe: string | null };

export default function PayrollPage() {
  const [groups, setGroups] = useState<Record<string, { proName: string; orders: OrderRow[] }>>({});
  const [payoutInfo, setPayoutInfo] = useState<Record<string, PayoutInfo>>({});
  const [loading, setLoading] = useState(true);
  const [payingPro, setPayingPro] = useState<string | null>(null);
  const [feeEditingPro, setFeeEditingPro] = useState<string | null>(null);
  const [feeInput, setFeeInput] = useState("0");
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const supabase = createClient();

  async function load() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
    if (me?.role !== "admin") {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setIsAdmin(true);

    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_number, pro_earnings, pro_payout_due_at, pro_id, pro:pro_id(full_name)")
      .eq("status", "completed")
      .order("pro_payout_due_at", { ascending: true });

    const byPro: Record<string, { proName: string; orders: OrderRow[] }> = {};
    for (const o of orders ?? []) {
      const proId = (o as any).pro_id ?? "unassigned";
      const proName = (o as any).pro?.full_name ?? "No pro assigned";
      if (!byPro[proId]) byPro[proId] = { proName, orders: [] };
      byPro[proId].orders.push(o as any);
    }
    setGroups(byPro);

    const proIds = Object.keys(byPro).filter((id) => id !== "unassigned");
    if (proIds.length > 0) {
      const { data: infoRows } = await supabase
        .from("pro_payout_info")
        .select("id, full_name, bank_name, clabe")
        .in("id", proIds);
      const infoMap: Record<string, PayoutInfo> = {};
      for (const row of infoRows ?? []) {
        infoMap[row.id] = { full_name: row.full_name, bank_name: row.bank_name, clabe: row.clabe };
      }
      setPayoutInfo(infoMap);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function confirmPayPro(proId: string, orderIds: string[]) {
    setPayingPro(proId);
    const res = await fetch("/api/admin/pay-pro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds, transferFee: Number(feeInput) || 0 }),
    });
    setPayingPro(null);
    setFeeEditingPro(null);
    setFeeInput("0");
    if (!res.ok) {
      alert("Couldn't mark this payout as paid, try again.");
      return;
    }
    load();
  }

  if (loading) return <p className="text-center mt-20">Loading payroll...</p>;

  if (isAdmin === false) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p>You don't have admin permissions.</p>
      </div>
    );
  }

  const proEntries = Object.entries(groups).filter(([, group]) =>
    group.proName.toLowerCase().includes(search.trim().toLowerCase())
  );
  const today = new Date();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-2">Payroll</h1>
      <p className="text-gray-400 text-sm mb-6">
        Pros are paid twice a month: the 14th and the 28th. Completed orders are grouped by pro so you
        can pay one lump sum per pro instead of order-by-order. Amounts shown are the pro's cut only
        (never the client's total), and each pro gets an email once you mark them as paid.
      </p>

      <input
        className="input max-w-xs mb-6"
        placeholder="Search by pro name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {proEntries.length === 0 && (
        <p className="text-gray-500">No completed orders waiting to be paid out right now.</p>
      )}

      <div className="flex flex-col gap-5">
        {proEntries.map(([proId, group]) => {
          const gross = group.orders.reduce((sum, o) => sum + Number(o.pro_earnings ?? 0), 0);
          const dueDate = group.orders[0]?.pro_payout_due_at ? new Date(group.orders[0].pro_payout_due_at) : null;
          const ready = dueDate ? dueDate <= today : false;
          const isEditingFee = feeEditingPro === proId;
          const fee = Math.max(0, Number(feeInput) || 0);
          const net = Math.round((gross - fee) * 100) / 100;

          return (
            <div key={proId} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold">{group.proName}</h2>
                  <p className="text-xs text-gray-400">
                    {dueDate ? `Payout date: ${format(dueDate, "MM/dd/yyyy")}` : "-"}
                    {ready ? (
                      <span className="text-yellow-400 font-semibold"> - Ready to pay</span>
                    ) : (
                      <span> - not due yet</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-accent2">${gross.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{group.orders.length} order(s)</p>
                </div>
              </div>

              {payoutInfo[proId] && (payoutInfo[proId].clabe || payoutInfo[proId].bank_name) ? (
                <div className="text-xs text-gray-400 bg-[#121018] border border-white/10 rounded p-2 mb-3">
                  <p>👤 {payoutInfo[proId].full_name || "-"}</p>
                  <p>🏦 {payoutInfo[proId].bank_name || "-"}</p>
                  <p>🔢 CLABE: {payoutInfo[proId].clabe || "-"}</p>
                </div>
              ) : proId !== "unassigned" ? (
                <p className="text-xs text-yellow-400 mb-3">⚠ This pro hasn't saved their payment details yet.</p>
              ) : null}

              <ul className="text-sm text-gray-300 space-y-1 mb-4">
                {group.orders.map((o) => (
                  <li key={o.id} className="flex justify-between">
                    <span>{o.order_number}</span>
                    <span>${Number(o.pro_earnings ?? 0).toFixed(2)}</span>
                  </li>
                ))}
              </ul>

              {isEditingFee ? (
                <div className="border border-white/10 rounded-lg p-3 space-y-2">
                  <label className="text-xs text-gray-400 block">
                    Transfer fee for sending this to their personal bank (Revolut, wire, etc.), optional
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="input w-28"
                      value={feeInput}
                      onChange={(e) => setFeeInput(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    Gross: ${gross.toFixed(2)} · Fee: -${fee.toFixed(2)} ·{" "}
                    <span className="text-accent2 font-semibold">Net to send: ${net.toFixed(2)}</span>
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      className="btn-secondary text-sm"
                      onClick={() => { setFeeEditingPro(null); setFeeInput("0"); }}
                      disabled={payingPro === proId}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn-primary text-sm"
                      onClick={() => confirmPayPro(proId, group.orders.map((o) => o.id))}
                      disabled={payingPro === proId}
                    >
                      {payingPro === proId ? "Marking as paid..." : `Confirm: sent $${net.toFixed(2)}`}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn-primary text-sm"
                  disabled={proId === "unassigned"}
                  onClick={() => { setFeeEditingPro(proId); setFeeInput("0"); }}
                >
                  {proId === "unassigned" ? "Assign a pro first" : `Mark ${group.orders.length} as paid...`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
