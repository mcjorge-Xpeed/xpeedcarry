"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";

type OrderRow = {
  id: string;
  order_number: string;
  price: number;
  pro_payout_due_at: string;
  pro_id: string;
};

export default function PayrollPage() {
  const [groups, setGroups] = useState<Record<string, { proName: string; orders: OrderRow[] }>>({});
  const [loading, setLoading] = useState(true);
  const [payingPro, setPayingPro] = useState<string | null>(null);
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
      .select("id, order_number, price, pro_payout_due_at, pro_id, pro:pro_id(full_name)")
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
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function payPro(proId: string, orderIds: string[]) {
    setPayingPro(proId);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("orders")
      .update({ status: "pro_paid", pro_paid_at: new Date().toISOString(), pro_paid_by: user?.id })
      .in("id", orderIds);
    setPayingPro(null);
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

  const proEntries = Object.entries(groups);
  const today = new Date();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-2">Payroll</h1>
      <p className="text-gray-400 text-sm mb-8">
        Pros are paid twice a month — the 14th and the 28th. Completed orders are grouped by pro so you
        can pay one lump sum per pro instead of order-by-order.
      </p>

      {proEntries.length === 0 && (
        <p className="text-gray-500">No completed orders waiting to be paid out right now.</p>
      )}

      <div className="flex flex-col gap-5">
        {proEntries.map(([proId, group]) => {
          const total = group.orders.reduce((sum, o) => sum + Number(o.price), 0);
          const dueDate = group.orders[0]?.pro_payout_due_at ? new Date(group.orders[0].pro_payout_due_at) : null;
          const ready = dueDate ? dueDate <= today : false;

          return (
            <div key={proId} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold">{group.proName}</h2>
                  <p className="text-xs text-gray-400">
                    {dueDate ? `Payout date: ${format(dueDate, "MM/dd/yyyy")}` : "-"}
                    {ready ? (
                      <span className="text-yellow-400 font-semibold"> — Ready to pay</span>
                    ) : (
                      <span> — not due yet</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-accent2">${total.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{group.orders.length} order(s)</p>
                </div>
              </div>

              <ul className="text-sm text-gray-300 space-y-1 mb-4">
                {group.orders.map((o) => (
                  <li key={o.id} className="flex justify-between">
                    <span>{o.order_number}</span>
                    <span>${Number(o.price).toFixed(2)}</span>
                  </li>
                ))}
              </ul>

              <button
                className="btn-primary text-sm"
                disabled={proId === "unassigned" || payingPro === proId}
                onClick={() => payPro(proId, group.orders.map((o) => o.id))}
              >
                {payingPro === proId
                  ? "Marking as paid..."
                  : proId === "unassigned"
                  ? "Assign a pro first"
                  : `Mark all ${group.orders.length} as paid ($${total.toFixed(2)})`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
