"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { buildPaymentRequestMessage } from "@/lib/paymentMessage";
import Chat from "@/components/Chat";
import PricingGuideSidebar from "@/components/PricingGuideSidebar";

// Stripe's standard US online-card rate. If your account is set up under a
// different country or takes a lot of international cards, check your real
// rate in the Stripe Dashboard, this is an estimate, not exact.
const STRIPE_PCT = 0.029;
const STRIPE_FIXED = 0.3;

function stripeFee(amount: number) {
  return Math.round((amount * STRIPE_PCT + STRIPE_FIXED) * 100) / 100;
}

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [pro, setPro] = useState<any>(null);
  const [pros, setPros] = useState<any[]>([]);
  const [selectedPro, setSelectedPro] = useState("");
  const [finalPrice, setFinalPrice] = useState("");
  const [proCutPercent, setProCutPercent] = useState("40");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const supabase = createClient();
  const isAdmin = role === "admin";

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    setAdminId(user?.id ?? null);

    const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
    setRole(me?.role ?? null);

    const { data: orderData } = await supabase.from("orders").select("*").eq("id", id).single();
    setOrder(orderData);
    setSelectedPro(orderData?.pro_id ?? "");
    const { data: prosData } = await supabase.from("profiles").select("*").eq("role", "pro");
    setPros(prosData ?? []);

    if (orderData?.client_id) {
      const { data: clientData } = await supabase.from("profiles").select("*").eq("id", orderData.client_id).single();
      setClient(clientData);
    }
    if (orderData?.pro_id) {
      const { data: proData } = await supabase.from("profiles").select("*").eq("id", orderData.pro_id).single();
      setPro(proData);
    } else {
      setPro(null);
    }

    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("order_id", id)
      .eq("type", "order")
      .maybeSingle();
    setConversationId(conv?.id ?? null);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function confirmPrice() {
    const price = Number(finalPrice);
    if (!price || price <= 0) return;
    const percent = Math.min(45, Math.max(0, Number(proCutPercent) || 0));
    await supabase.from("orders").update({ price, price_confirmed: true, pro_cut_percent: percent }).eq("id", id);

    if (conversationId && adminId && order) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: adminId,
        content: buildPaymentRequestMessage({
          orderId: order.id,
          clientId: order.client_id,
          orderNumber: order.order_number,
          title: order.title,
          price,
        }),
      });
    }

    setFinalPrice("");
    load();
  }

  async function assignPro() {
    // Deliberately doesn't touch conversations.pro_id (and doesn't touch
    // order status), the pro can accept/decline right away, but only gets
    // chat access and can only start once the client has actually paid
    // (that link is made server-side in the Stripe webhook).
    await supabase
      .from("orders")
      .update({ pro_id: selectedPro, pro_accepted: false })
      .eq("id", id);

    load();
  }

  async function overrideConfirm() {
    await supabase.from("orders").update({ status: "completed", confirmed_by: "admin_override" }).eq("id", id);
    load();
  }

  async function toggleSuspend(profileId: string, currentlyActive: boolean) {
    await supabase.from("profiles").update({ active: !currentlyActive }).eq("id", profileId);
    load();
  }

  async function markProPaid() {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("orders")
      .update({ status: "pro_paid", pro_paid_at: new Date().toISOString(), pro_paid_by: user?.id })
      .eq("id", id);
    load();
  }

  async function cancelAndClose() {
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
    if (conversationId) {
      await supabase.from("conversations").update({ closed: true }).eq("id", conversationId);
    }
    load();
  }

  async function deleteOrder() {
    const paidStatuses = ["paid", "assigned", "in_progress", "delivered", "completed", "pro_paid"];
    const warning = paidStatuses.includes(order.status)
      ? `This order was PAID (status: ${order.status}). Deleting it removes it and its chat from XpeedCarry permanently, but does NOT refund or affect the Stripe charge. Are you sure?`
      : "Delete this order and its chat permanently? This can't be undone.";
    if (!confirm(warning)) return;

    setDeleting(true);
    const res = await fetch("/api/admin/delete-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id }),
    });
    if (res.ok) {
      router.push("/admin");
    } else {
      setDeleting(false);
      alert("Couldn't delete the order, try again.");
    }
  }

  const enteredPrice = Number(finalPrice) || 0;
  const enteredFee = useMemo(() => stripeFee(enteredPrice), [enteredPrice]);
  const enteredNet = Math.round((enteredPrice - enteredFee) * 100) / 100;
  const enteredPercent = Math.min(45, Math.max(0, Number(proCutPercent) || 0));
  const enteredProCut = Math.round((enteredPrice * enteredPercent) / 100 * 100) / 100;

  if (!order || role === null) return <p className="text-center mt-20">Loading...</p>;

  if (role !== "admin" && role !== "support") {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p>You don't have admin permissions.</p>
      </div>
    );
  }

  const payoutReady = order.pro_payout_due_at && new Date(order.pro_payout_due_at) <= new Date();
  const confirmedFee = order.price_confirmed ? stripeFee(Number(order.price)) : 0;
  const confirmedNet = order.price_confirmed ? Math.round((Number(order.price) - confirmedFee) * 100) / 100 : 0;
  const hoursSinceDelivered = order.delivered_at
    ? (Date.now() - new Date(order.delivered_at).getTime()) / (1000 * 60 * 60)
    : 0;
  const overrideAvailable = hoursSinceDelivered >= 12;

  return (
    <div className="max-w-5xl mx-auto mt-10 px-4">
      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
      <div>
      <div className="card p-6 space-y-4">
        <div>
          <p className="text-sm text-gray-400">{order.order_number}</p>
          <h1 className="text-xl font-bold">{order.title}</h1>
          <p className="text-gray-400 text-sm mt-1">{order.description}</p>
          <p className="font-bold mt-2">
            {order.price_confirmed ? `$${order.price}` : "Price not set yet"}, Status: {order.status}
          </p>
          {order.price_confirmed && (
            <p className="text-xs text-gray-500 mt-1">
              Est. Stripe fee: ${confirmedFee.toFixed(2)} · Pro gets: ${Number(order.pro_earnings ?? 0).toFixed(2)}
              {" "}({order.pro_cut_percent ?? 0}%) · You keep: ${(confirmedNet - Number(order.pro_earnings ?? 0)).toFixed(2)}
            </p>
          )}
        </div>

        {!order.price_confirmed && (
          <div className="border border-yellow-500/30 rounded-lg p-4">
            <label className="text-sm text-yellow-400 font-semibold">Set final price (custom order)</label>
            <div className="flex gap-2 mt-2">
              <input
                type="number"
                min={0.99}
                step="0.01"
                className="input"
                placeholder="e.g. 45.00"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
              />
              <button className="btn-primary whitespace-nowrap" onClick={confirmPrice}>Confirm Price</button>
            </div>
            <div className="mt-3">
              <label className="text-xs text-gray-400 whitespace-nowrap">Pro gets:</label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setProCutPercent("40")}
                  className={`flex-1 text-sm px-3 py-2 rounded border transition ${
                    proCutPercent === "40" ? "border-accent text-accent bg-accent/10" : "border-white/10 text-gray-400"
                  }`}
                >
                  🏠 Casa (40% neto)
                </button>
                <button
                  type="button"
                  onClick={() => setProCutPercent("30")}
                  className={`flex-1 text-sm px-3 py-2 rounded border transition ${
                    proCutPercent === "30" ? "border-accent text-accent bg-accent/10" : "border-white/10 text-gray-400"
                  }`}
                >
                  Normal (30% neto)
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                The pro only ever sees the dollar amount, never the total price.
              </p>
            </div>
            {enteredPrice > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                Stripe fee (est.): <span className="text-red-400">-${enteredFee.toFixed(2)}</span> · Pro gets:{" "}
                <span className="text-accent2 font-semibold">${enteredProCut.toFixed(2)}</span> · You'd keep:{" "}
                <span className="text-accent2 font-semibold">${(enteredNet - enteredProCut).toFixed(2)}</span>
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              Agree on a price with the client in the chat first, then confirm it here, the client will
              see a "Pay Now" button appear on their order page.
            </p>
          </div>
        )}

        {order.price_confirmed && (
          <div className="border-t border-white/10 pt-4">
            <label className="text-sm text-gray-400">Assign pro</label>
            <div className="flex gap-2 mt-1">
              <select className="input" value={selectedPro} onChange={(e) => setSelectedPro(e.target.value)}>
                <option value="">Select a pro</option>
                {pros.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
              <button className="btn-primary" onClick={assignPro}>Assign</button>
            </div>
            {order.pro_id && (
              <p className="text-xs text-gray-400 mt-2">
                {order.pro_accepted
                  ? order.status === "pending_payment"
                    ? `${pro?.full_name ?? "Pro"} accepted, they can start as soon as the client pays.`
                    : `${pro?.full_name ?? "Pro"} accepted and can already see the chat.`
                  : `Offered to ${pro?.full_name ?? "pro"}, waiting for them to accept or decline.`}
              </p>
            )}
          </div>
        )}

        {order.status === "in_progress" && (
          <p className="text-sm text-gray-500">
            Waiting for the pro to deliver, they'll upload proof and mark it delivered from their dashboard.
          </p>
        )}

        {order.status === "delivered" && (
          <div className="border border-yellow-500/30 rounded-lg p-4">
            <p className="text-sm text-yellow-400 font-semibold mb-1">Delivered, waiting for client confirmation</p>
            <p className="text-xs text-gray-400 mb-2">
              Delivered {order.delivered_at ? new Date(order.delivered_at).toLocaleString() : "-"} (
              {hoursSinceDelivered.toFixed(1)}h ago)
            </p>
            {order.evidence_url && (
              <a href={order.evidence_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-sm block mb-3">
                View proof of completion →
              </a>
            )}
            <button className="btn-primary" onClick={overrideConfirm} disabled={!overrideAvailable}>
              {overrideAvailable ? "Override & Confirm Completion" : `Available in ${(12 - hoursSinceDelivered).toFixed(1)}h`}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Only use this if the client hasn't responded, normally let them confirm from their own order page.
            </p>
          </div>
        )}

        {order.status === "completed" && (
          <div className="border-t border-white/10 pt-4">
            <p className="text-sm text-gray-400 mb-2">
              Confirmed by: {order.confirmed_by === "admin_override" ? "admin override" : order.confirmed_by === "client" ? "client" : "-"}
            </p>
            <p className="text-sm text-gray-400 mb-2">
              Pro payout date: {order.pro_payout_due_at ? new Date(order.pro_payout_due_at).toLocaleDateString() : "-"}
              {" "}(paid on the 14th/28th, not right away)
              {payoutReady && <span className="text-yellow-400 font-semibold"> - Ready to pay</span>}
            </p>
            {isAdmin && (
              <>
                <p className="text-xs text-gray-500 mb-2">
                  Tip: pay pros in bulk from the <Link href="/admin/payroll" className="text-accent hover:underline">Payroll</Link> page instead of one by one.
                </p>
                <button className="btn-primary" onClick={markProPaid}>
                  Mark as paid to pro (manual, via Stripe)
                </button>
              </>
            )}
          </div>
        )}

        {order.status === "pro_paid" && (
          <div>
            <p className="text-accent2 font-semibold">✅ Paid to pro on {new Date(order.pro_paid_at).toLocaleDateString()}</p>
            <p className="text-xs text-gray-500 mt-1">
              Gross: ${Number(order.pro_earnings ?? 0).toFixed(2)}
              {Number(order.pro_payout_fee ?? 0) > 0 && (
                <> · Transfer fee: -${Number(order.pro_payout_fee).toFixed(2)} · Net sent: $
                {(Number(order.pro_earnings ?? 0) - Number(order.pro_payout_fee ?? 0)).toFixed(2)}</>
              )}
            </p>
          </div>
        )}

        {order.status === "cancelled" ? (
          <p className="text-gray-500 text-sm">This order is cancelled and its chat is closed.</p>
        ) : (
          order.status !== "pro_paid" && (
            <button className="btn-secondary text-sm text-red-400" onClick={cancelAndClose}>
              Client not interested, Cancel Order & Close Chat
            </button>
          )
        )}

        {isAdmin && (
          <div className="border-t border-white/10 pt-4">
            <p className="text-xs uppercase tracking-widest text-red-400 font-bold mb-2">Moderation</p>
            <p className="text-xs text-gray-500 mb-3">
              Use if someone was disrespectful, demanded things outside this order, or broke the rules.
              Suspending blocks that account from using the site entirely until you reactivate it.
            </p>
            <div className="flex gap-2 flex-wrap">
              {client && (
                <button
                  className={`btn-secondary text-sm ${client.active ? "text-red-400" : "text-accent2"}`}
                  onClick={() => toggleSuspend(client.id, client.active)}
                >
                  {client.active ? `Suspend Client (${client.full_name ?? "client"})` : `Reactivate Client (${client.full_name ?? "client"})`}
                </button>
              )}
              {pro && (
                <button
                  className={`btn-secondary text-sm ${pro.active ? "text-red-400" : "text-accent2"}`}
                  onClick={() => toggleSuspend(pro.id, pro.active)}
                >
                  {pro.active ? `Suspend Pro (${pro.full_name ?? "pro"})` : `Reactivate Pro (${pro.full_name ?? "pro"})`}
                </button>
              )}
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="border-t border-white/10 pt-4">
            <p className="text-xs uppercase tracking-widest text-red-400 font-bold mb-2">Danger Zone</p>
            <button className="btn-secondary text-sm text-red-400" onClick={deleteOrder} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete Order Permanently"}
            </button>
          </div>
        )}
      </div>

      {conversationId && adminId && (
        <div className="mt-6">
          <h2 className="font-semibold mb-2">Chat with client</h2>
          <Chat conversationId={conversationId} currentUserId={adminId} />
        </div>
      )}
      </div>
      <PricingGuideSidebar />
      </div>
    </div>
  );
}
