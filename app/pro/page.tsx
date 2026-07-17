"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ProDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (me?.role !== "pro" && me?.role !== "admin") {
        setIsPro(false);
        setLoading(false);
        return;
      }
      setIsPro(true);

      const { data } = await supabase
        .from("orders")
        .select("id, order_number, title, status, pro_accepted, pro_earnings, created_at, client:client_id(full_name)")
        .eq("pro_id", user.id)
        .order("created_at", { ascending: false });
      setOrders(data ?? []);
      setLoading(false);
    })();
  }, []);

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
      return o.pro_accepted ? "Accepted — waiting for payment" : "New offer — respond";
    }
    const labels: Record<string, string> = {
      paid: "Paid — starting soon",
      in_progress: "In progress",
      delivered: "Delivered — waiting for client",
      completed: "Completed — awaiting payout",
      pro_paid: "Paid out",
    };
    return labels[o.status] ?? o.status;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-2">My Orders</h1>
      <p className="text-gray-400 text-sm mb-8">
        Orders assigned to you. Pros are paid twice a month, on the 14th and the 28th.
      </p>

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
