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

// Categories drawn from Community Guidelines / Terms. Kept as plain text
// (not a DB enum) on purpose, so wording can change later without a migration.
const WARNING_CATEGORIES: Record<"yellow" | "red", string[]> = {
  yellow: [
    "Unprofessional tone / minor disrespect",
    "Late or unresponsive without notice",
    "Went outside agreed scope without checking with support",
    "Client complained about effort/quality",
    "Other",
  ],
  red: [
    "Harassment, threats, discrimination, or abusive language",
    "Solicited off-platform payment or contact",
    "Broke account-handling confidentiality",
    "Repeated or severe scope violation",
    "Other",
  ],
};

// Sugerencia por categoría al registrar una roja, el admin puede cambiarla
// antes de guardar.
const RED_DEFAULTS: Record<string, { scope: "order" | "total"; fine: number }> = {
  "Harassment, threats, discrimination, or abusive language": { scope: "order", fine: 0 },
  "Solicited off-platform payment or contact": { scope: "total", fine: 750 },
  "Broke account-handling confidentiality": { scope: "order", fine: 0 },
  "Repeated or severe scope violation": { scope: "order", fine: 0 },
  Other: { scope: "order", fine: 0 },
};

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
  const [warningType, setWarningType] = useState<"yellow" | "red">("yellow");
  const [warningCategory, setWarningCategory] = useState(WARNING_CATEGORIES.yellow[0]);
  const [warningNote, setWarningNote] = useState("");
  const [submittingWarning, setSubmittingWarning] = useState(false);
  const [warningSaved, setWarningSaved] = useState(false);
  const [withholdScope, setWithholdScope] = useState<"order" | "total">("order");
  const [fineAmount, setFineAmount] = useState("0");
  const [proWarningCounts, setProWarningCounts] = useState({ yellow: 0, red: 0 });
  const [showEscalationPrompt, setShowEscalationPrompt] = useState(false);
  const [showBanPrompt, setShowBanPrompt] = useState(false);
  const [startingInvestigation, setStartingInvestigation] = useState(false);
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

      const { count: yellowCount } = await supabase
        .from("pro_warnings")
        .select("id", { count: "exact", head: true })
        .eq("pro_id", orderData.pro_id)
        .eq("type", "yellow");
      const { count: redCount } = await supabase
        .from("pro_warnings")
        .select("id", { count: "exact", head: true })
        .eq("pro_id", orderData.pro_id)
        .eq("type", "red");
      setProWarningCounts({ yellow: yellowCount ?? 0, red: redCount ?? 0 });
      setShowEscalationPrompt((yellowCount ?? 0) >= 3);
      setShowBanPrompt((redCount ?? 0) >= 2 && proData?.active !== false);
    } else {
      setPro(null);
      setProWarningCounts({ yellow: 0, red: 0 });
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
    const assignedProProfile = pros.find((p) => p.id === selectedPro);
    const updates: any = { pro_id: selectedPro, pro_accepted: false };
    const hasPenalty = (assignedProProfile?.penalty_orders_remaining ?? 0) > 0;

    if (hasPenalty) {
      updates.pro_cut_percent = assignedProProfile.is_house_pro ? 30 : 20;
    }

    await supabase.from("orders").update(updates).eq("id", id);

    if (hasPenalty) {
      await supabase
        .from("profiles")
        .update({ penalty_orders_remaining: assignedProProfile.penalty_orders_remaining - 1 })
        .eq("id", selectedPro);
      alert(
        `${assignedProProfile.full_name ?? "This pro"} has an active rate penalty (${assignedProProfile.penalty_orders_remaining} order(s) left) — their cut was set to the reduced rate for this order.`
      );
    }

    load();
  }

  async function overrideConfirm() {
    await supabase.from("orders").update({ status: "completed", confirmed_by: "admin_override" }).eq("id", id);
    load();
  }

  async function submitWarning(e: React.FormEvent) {
    e.preventDefault();
    if (!pro || !adminId) return;
    setSubmittingWarning(true);
    setWarningSaved(false);

    const scope = warningType === "red" ? withholdScope : "order";
    const fine = warningType === "red" ? Number(fineAmount) || 0 : 0;

    const { data: inserted } = await supabase
      .from("pro_warnings")
      .insert({
        pro_id: pro.id,
        order_id: order.id,
        type: warningType,
        category: warningCategory,
        note: warningNote || null,
        issued_by: adminId,
        withhold_scope: scope,
        fine_amount: fine || null,
      })
      .select()
      .single();

    if (scope === "total") {
      await supabase
        .from("orders")
        .update({ payout_withheld: true, withheld_by_warning_id: inserted?.id })
        .eq("pro_id", pro.id)
        .eq("status", "completed")
        .is("pro_paid_at", null);
    } else {
      await supabase
        .from("orders")
        .update({ payout_withheld: true, withheld_by_warning_id: inserted?.id })
        .eq("id", order.id);
    }

    // 2da amarilla: activa tarifa reducida en las próximas 3 órdenes.
    if (warningType === "yellow" && proWarningCounts.yellow + 1 === 2) {
      await supabase.from("profiles").update({ penalty_orders_remaining: 3 }).eq("id", pro.id);
    }

    setWarningNote("");
    setSubmittingWarning(false);
    setWarningSaved(true);
    load();
  }

  async function startInvestigation() {
    if (!pro || !adminId) return;
    if (!confirm(`Put ${pro.full_name ?? "this pro"} under investigation? This blocks their account entirely and withholds this order's payout until you resolve it.`)) return;
    setStartingInvestigation(true);
    await supabase.from("profiles").update({ under_investigation: true }).eq("id", pro.id);
    const { data: inserted } = await supabase
      .from("pro_warnings")
      .insert({
        pro_id: pro.id,
        order_id: order.id,
        type: "investigating",
        category: "Under investigation",
        note: warningNote || null,
        issued_by: adminId,
      })
      .select()
      .single();
    await supabase
      .from("orders")
      .update({ payout_withheld: true, withheld_by_warning_id: inserted?.id })
      .eq("id", order.id);
    setStartingInvestigation(false);
    load();
  }

  async function resolveInvestigation(cleared: boolean) {
    if (!pro) return;
    await supabase.from("profiles").update({ under_investigation: false }).eq("id", pro.id);
    if (cleared) {
      await supabase.from("orders").update({ payout_withheld: false }).eq("id", order.id);
    }
    load();
  }

  async function permanentlyBanPro() {
    if (!pro) return;
    if (!confirm(`Permanently ban ${pro.full_name ?? "this pro"}? This is meant to be final, reactivating later should be a deliberate exception.`)) return;
    await supabase.from("profiles").update({ active: false, permanently_banned: true }).eq("id", pro.id);
    setShowBanPrompt(false);
    load();
  }

  async function undoWithhold() {
    await supabase.from("orders").update({ payout_withheld: false }).eq("id", id);
    load();
  }

  async function toggleSuspend(profileId: string, currentlyActive: boolean) {
    await supabase.from("profiles").update({ active: !currentlyActive }).eq("id", profileId);
    load();
  }

  async function toggleFeatured() {
    await supabase.from("orders").update({ featured_on_site: !order.featured_on_site }).eq("id", id);
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
          {order.payout_withheld && (
            <p className="text-xs text-red-400 mt-1">
              ⚠ Payout withheld for this order (from a warning).{" "}
              {isAdmin && (
                <button className="underline hover:text-red-300" onClick={undoWithhold}>
                  Undo
                </button>
              )}
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
            {(order.evidence_urls ?? []).length > 0 && (
              <div className="flex flex-col gap-1 mb-3">
                {order.evidence_urls.map((url: string, i: number) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-sm block">
                    View proof of completion {order.evidence_urls.length > 1 ? `#${i + 1}` : ""} →
                  </a>
                ))}
              </div>
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

            {order.rated_at && (
              <div className="mb-2">
                <p className="text-sm text-gray-300">
                  Client rating: <span className="text-yellow-400">{"★".repeat(order.rating)}{"☆".repeat(5 - order.rating)}</span>
                  {order.rating_comment && <span className="text-gray-400"> — "{order.rating_comment}"</span>}
                </p>
                <label className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                  <input type="checkbox" checked={!!order.featured_on_site} onChange={toggleFeatured} />
                  Feature this review on the homepage
                </label>
              </div>
            )}
            {order.tip_paid_at && (
              <p className="text-sm text-gray-300 mb-2">
                Tip: ${Number(order.tip_amount).toFixed(2)} (pro gets ${Number(order.tip_pro_payout).toFixed(2)}, XpeedCarry keeps ${(Number(order.tip_amount) - Number(order.tip_pro_payout)).toFixed(2)})
              </p>
            )}

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

        {pro && (
          <div className="border-t border-white/10 pt-4">
            <p className="text-xs uppercase tracking-widest text-yellow-400 font-bold mb-2">
              Log a warning ({pro.full_name ?? "pro"})
            </p>
            <p className="text-xs text-gray-500 mb-3">
              History: 🟡 {proWarningCounts.yellow} · 🔴 {proWarningCounts.red}
              {pro.penalty_orders_remaining > 0 && ` · ⚠ Reduced rate active (${pro.penalty_orders_remaining} order(s) left)`}
              {pro.under_investigation && " · 🔍 Under investigation"}
            </p>

            {pro.under_investigation && (
              <div className="border border-blue-400/40 rounded-lg p-3 mb-3">
                <p className="text-sm text-blue-300 font-semibold mb-2">🔍 This pro is under investigation</p>
                <div className="flex gap-2">
                  <button className="btn-secondary text-sm" onClick={() => resolveInvestigation(true)}>
                    Clear (no violation found)
                  </button>
                  <button className="btn-secondary text-sm text-yellow-400" onClick={() => resolveInvestigation(false)}>
                    End investigation, log a warning below
                  </button>
                </div>
              </div>
            )}

            {showEscalationPrompt && !pro.under_investigation && (
              <div className="border border-yellow-400/40 rounded-lg p-3 mb-3">
                <p className="text-sm text-yellow-400 font-semibold">
                  ⚠ This pro has 3+ yellow warnings. Per policy, consider logging a Red for "Repeated or severe scope violation."
                </p>
              </div>
            )}

            {showBanPrompt && !pro.under_investigation && (
              <div className="border border-red-500/50 rounded-lg p-3 mb-3">
                <p className="text-sm text-red-400 font-semibold mb-2">
                  🚫 This pro has 2+ red warnings. Per policy, this is a permanent-ban case.
                </p>
                <button className="btn-secondary text-sm text-red-400" onClick={permanentlyBanPro}>
                  Permanently ban this pro
                </button>
              </div>
            )}

            {!pro.under_investigation && (
              <>
                <button
                  type="button"
                  onClick={startInvestigation}
                  disabled={startingInvestigation}
                  className="text-xs text-blue-300 border border-blue-400/30 rounded px-3 py-1.5 mb-3 hover:bg-blue-400/10"
                >
                  🔍 Start Investigation (blocks account, withholds this order, decide later)
                </button>
                <form onSubmit={submitWarning} className="flex flex-col gap-2 max-w-md">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setWarningType("yellow"); setWarningCategory(WARNING_CATEGORIES.yellow[0]); }}
                      className={`flex-1 text-sm px-3 py-2 rounded border transition ${
                        warningType === "yellow" ? "border-yellow-400 text-yellow-400 bg-yellow-400/10" : "border-white/10 text-gray-400"
                      }`}
                    >
                      🟡 Yellow
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWarningType("red");
                        const cat = WARNING_CATEGORIES.red[0];
                        setWarningCategory(cat);
                        const d = RED_DEFAULTS[cat];
                        setWithholdScope(d.scope);
                        setFineAmount(String(d.fine));
                      }}
                      className={`flex-1 text-sm px-3 py-2 rounded border transition ${
                        warningType === "red" ? "border-red-400 text-red-400 bg-red-400/10" : "border-white/10 text-gray-400"
                      }`}
                    >
                      🔴 Red
                    </button>
                  </div>
                  <select
                    className="input text-sm"
                    value={warningCategory}
                    onChange={(e) => {
                      setWarningCategory(e.target.value);
                      if (warningType === "red") {
                        const d = RED_DEFAULTS[e.target.value] ?? { scope: "order", fine: 0 };
                        setWithholdScope(d.scope);
                        setFineAmount(String(d.fine));
                      }
                    }}
                  >
                    {WARNING_CATEGORIES[warningType].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  {warningType === "yellow" && (
                    <p className="text-xs text-gray-500">Withholds this order's payout automatically.</p>
                  )}

                  {warningType === "red" && (
                    <div className="border border-white/10 rounded-lg p-2 flex flex-col gap-2">
                      <label className="text-xs text-gray-400">Withhold payout:</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setWithholdScope("order")}
                          className={`flex-1 text-xs px-2 py-1.5 rounded border transition ${
                            withholdScope === "order" ? "border-accent text-accent bg-accent/10" : "border-white/10 text-gray-400"
                          }`}
                        >
                          This order only
                        </button>
                        <button
                          type="button"
                          onClick={() => setWithholdScope("total")}
                          className={`flex-1 text-xs px-2 py-1.5 rounded border transition ${
                            withholdScope === "total" ? "border-accent text-accent bg-accent/10" : "border-white/10 text-gray-400"
                          }`}
                        >
                          Entire pending balance
                        </button>
                      </div>
                      <label className="text-xs text-gray-400">Fine (record only, $0 if none):</label>
                      <div className="flex items-center gap-1">
                        <span className="text-sm">$</span>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          className="input py-1 px-2 text-sm"
                          value={fineAmount}
                          onChange={(e) => setFineAmount(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <input
                    type="text"
                    placeholder="Note (optional)"
                    className="input text-sm"
                    value={warningNote}
                    onChange={(e) => setWarningNote(e.target.value)}
                  />
                  <button className="btn-secondary text-sm" disabled={submittingWarning}>
                    {submittingWarning ? "Saving..." : "Log Warning"}
                  </button>
                  {warningSaved && <p className="text-accent2 text-xs">✅ Logged.</p>}
                </form>
              </>
            )}
          </div>
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
