"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Toast = { id: string; orderNumber: string; title: string };

export default function NewOrderNotifier() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const supabase = createClient();
  const askedPermission = useRef(false);

  useEffect(() => {
    if (!askedPermission.current && "Notification" in window && Notification.permission === "default") {
      askedPermission.current = true;
      Notification.requestPermission();
    }

    const channel = supabase
      .channel("new-orders-admin")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const order = payload.new as any;

          setToasts((prev) => [...prev, { id: order.id, orderNumber: order.order_number, title: order.title }]);
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== order.id));
          }, 12000);

          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("New order on XpeedCarry", {
              body: `${order.order_number}: ${order.title}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2">
      {toasts.map((t) => (
        <Link
          key={t.id}
          href={`/admin/orders/${t.id}`}
          className="card p-4 w-72 border-accent shadow-xl hover:border-accent2 transition block"
        >
          <p className="text-xs uppercase tracking-wide text-accent font-bold mb-1">🔔 New Order</p>
          <p className="text-sm font-semibold">{t.orderNumber}</p>
          <p className="text-xs text-gray-400 truncate">{t.title}</p>
        </Link>
      ))}
    </div>
  );
}
