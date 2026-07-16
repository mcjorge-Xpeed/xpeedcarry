import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format } from "date-fns";

export const revalidate = 0;

export default async function AdminPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (me?.role !== "admin") {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p>You don't have admin permissions.</p>
      </div>
    );
  }

  const [{ data: orders }, { data: clients }, { data: pros }, { data: supportChats }, { data: orderChats }] = await Promise.all([
    supabase.from("orders").select("*, client:client_id(full_name), pro:pro_id(full_name)").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").eq("role", "client"),
    supabase.from("profiles").select("*").eq("role", "pro"),
    supabase.from("conversations").select("id, created_at, client:client_id(full_name)").eq("type", "support").eq("closed", false).order("created_at", { ascending: false }),
    supabase
      .from("conversations")
      .select("id, created_at, order_id, client:client_id(full_name), order:order_id(order_number)")
      .eq("type", "order")
      .eq("closed", false)
      .order("created_at", { ascending: false }),
  ]);

  const inbox = [
    ...(supportChats ?? []).map((c: any) => ({
      id: c.id,
      client: c.client?.full_name ?? "-",
      label: "Support",
      href: `/admin/support/${c.id}`,
      created_at: c.created_at,
    })),
    ...(orderChats ?? []).map((c: any) => ({
      id: c.id,
      client: c.client?.full_name ?? "-",
      label: c.order?.order_number ?? "Order",
      href: `/admin/orders/${c.order_id}`,
      created_at: c.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const pendingPayouts = orders?.filter((o: any) => o.status === "completed");
  const pendingPayoutTotal = pendingPayouts?.reduce((sum: number, o: any) => sum + Number(o.price), 0) ?? 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <div className="flex gap-2">
          <Link href="/admin/users" className="btn-secondary text-sm">
            🛡️ Users
          </Link>
          <Link href="/admin/payroll" className="btn-secondary text-sm">
            💰 Payroll
          </Link>
          <Link href="/admin/pricing-guide" className="btn-secondary text-sm">
            📋 Pricing Guide
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="card p-5">
          <p className="text-gray-400 text-sm">Clients</p>
          <p className="text-3xl font-bold">{clients?.length ?? 0}</p>
        </div>
        <div className="card p-5">
          <p className="text-gray-400 text-sm">Pros</p>
          <p className="text-3xl font-bold">{pros?.length ?? 0}</p>
        </div>
        <div className="card p-5">
          <p className="text-gray-400 text-sm">Total Orders</p>
          <p className="text-3xl font-bold">{orders?.length ?? 0}</p>
        </div>
      </div>

      {pendingPayouts && pendingPayouts.length > 0 && (
        <div className="card p-5 mb-10 border-yellow-500/50 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-yellow-400 mb-1">⚠ Pros waiting to be paid</h2>
            <p className="text-sm text-gray-400">
              {pendingPayouts.length} completed order(s), ${pendingPayoutTotal.toFixed(2)} total. Paid out on the 14th and 28th.
            </p>
          </div>
          <Link href="/admin/payroll" className="btn-primary text-sm">
            Open Payroll
          </Link>
        </div>
      )}

      {inbox.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mb-4">Inbox — all chats</h2>
          <div className="card overflow-x-auto mb-10">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-400 border-b border-white/10">
                <tr>
                  <th className="p-3">Client</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Started</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {inbox.map((c) => (
                  <tr key={c.id} className="border-b border-white/5">
                    <td className="p-3">{c.client}</td>
                    <td className="p-3">{c.label}</td>
                    <td className="p-3">{format(new Date(c.created_at), "MM/dd/yyyy")}</td>
                    <td className="p-3">
                      <Link href={c.href} className="text-accent2 hover:underline">
                        Open Chat
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="text-xl font-semibold mb-4">Orders</h2>
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
            {orders?.map((o: any) => (
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
