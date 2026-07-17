"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });
      setOrders(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-center mt-20">Loading...</p>;

  const statusLabels: Record<string, string> = {
    pending_payment: "Waiting for price confirmation",
    paid: "Paid, assigning a pro",
    assigned: "Pro assigned",
    in_progress: "In progress",
    delivered: "Delivered, review & confirm",
    completed: "Completed",
    pro_paid: "Completed",
    cancelled: "Cancelled",
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">My Orders</h1>
        <Link href="/order/new" className="btn-secondary text-sm">
          New Order
        </Link>
      </div>
      <p className="text-gray-400 text-sm mb-8">
        Every order you've created, with a direct link back to its chat.
      </p>

      {orders.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-400 mb-4">You haven't created any orders yet.</p>
          <Link href="/order/new" className="btn-primary inline-block">
            Create Your First Order
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/order/${o.id}`}
              className="card p-5 flex items-center justify-between hover:border-accent transition"
            >
              <div>
                <p className="text-sm text-gray-400">{o.order_number}</p>
                <h2 className="font-semibold">{o.title}</h2>
              </div>
              <div className="text-right">
                {o.price_confirmed && o.price > 0 && (
                  <p className="font-bold text-accent2">${o.price}</p>
                )}
                <p className="text-xs text-gray-400">{statusLabels[o.status] ?? o.status}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
