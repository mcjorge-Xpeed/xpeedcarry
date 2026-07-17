"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";

const STATUS_OPTIONS = [
  "pending_payment",
  "paid",
  "assigned",
  "in_progress",
  "delivered",
  "completed",
  "pro_paid",
  "cancelled",
];

export default function AdminOrdersTable({ orders }: { orders: any[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesSearch =
        !q ||
        o.order_number?.toLowerCase().includes(q) ||
        o.client?.full_name?.toLowerCase().includes(q) ||
        o.pro?.full_name?.toLowerCase().includes(q);
      const matchesStatus = !status || o.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, status]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          className="input sm:max-w-xs"
          placeholder="Search order #, client, or pro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input sm:max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(search || status) && (
          <button className="btn-secondary text-sm" onClick={() => { setSearch(""); setStatus(""); }}>
            Clear
          </button>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-400 border-b border-white/10">
            <tr>
              <th className="p-3">Order #</th>
              <th className="p-3">Client</th>
              <th className="p-3">Pro</th>
              <th className="p-3">Price</th>
              <th className="p-3">Status</th>
              <th className="p-3">Pro payout due</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-b border-white/5">
                <td className="p-3">{o.order_number}</td>
                <td className="p-3">{o.client?.full_name ?? "-"}</td>
                <td className="p-3">{o.pro?.full_name ?? "Unassigned"}</td>
                <td className="p-3">{o.price_confirmed ? `$${o.price}` : "Pending quote"}</td>
                <td className="p-3">{o.status}</td>
                <td className="p-3">{o.pro_payout_due_at ? format(new Date(o.pro_payout_due_at), "MM/dd/yyyy") : "-"}</td>
                <td className="p-3">
                  <Link href={`/admin/orders/${o.id}`} className="text-accent2 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No orders match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
