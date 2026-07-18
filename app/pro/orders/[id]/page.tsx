"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Chat from "@/components/Chat";

export default function ProOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [order, setOrder] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setUserId(user.id);

    const { data: orderData } = await supabase
      .from("orders")
      .select("id, order_number, title, description, status, pro_accepted, pro_earnings, delivered_at, evidence_url, pro_payout_due_at, pro_paid_at")
      .eq("id", id)
      .single();
    setOrder(orderData);

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

  async function acceptOrder() {
    setUpdating(true);
    // Goes through a server route (not a direct client update) because
    // granting chat access when payment already landed means writing to
    // conversations.pro_id, and pros don't have RLS permission to do that
    // themselves, only the server's admin client can.
    await fetch("/api/pro/respond-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id, accept: true }),
    });
    setUpdating(false);
    load();
  }

  async function declineOrder() {
    if (!confirm("Decline this order? It'll go back to unassigned so support can offer it to someone else.")) return;
    setUpdating(true);
    await fetch("/api/pro/respond-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id, accept: false }),
    });
    setUpdating(false);
    window.location.href = "/pro";
  }

  async function submitEvidence(file: File) {
    setError("");
    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `${id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("order-evidence").upload(path, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("order-evidence").getPublicUrl(path);

    await supabase
      .from("orders")
      .update({ status: "delivered", delivered_at: new Date().toISOString(), evidence_url: publicUrl.publicUrl })
      .eq("id", id);

    setUploading(false);
    load();
  }

  if (!order || !userId) return <p className="text-center mt-20">Loading...</p>;

  const statusLabels: Record<string, string> = {
    pending_payment: order.pro_accepted ? "Accepted, waiting for client to pay" : "New offer, respond below",
    paid: "Paid, starting soon",
    in_progress: "In progress",
    delivered: "Delivered, waiting for client to confirm",
    completed: "Completed, awaiting payout",
    pro_paid: "Paid out",
  };

  const canWork = order.pro_accepted && order.status !== "pending_payment";

  return (
    <div className="max-w-2xl mx-auto mt-10 px-4">
      <div className="card p-6 mb-6">
        <p className="text-sm text-gray-400">{order.order_number}</p>
        <h1 className="text-xl font-bold">{order.title}</h1>
        <p className="text-gray-400 text-sm mt-2 whitespace-pre-line">{order.description}</p>
        <p className="mt-3 font-bold">Your payout: ${Number(order.pro_earnings ?? 0).toFixed(2)}, {statusLabels[order.status] ?? order.status}</p>

        {!order.pro_accepted && (
          <div className="mt-4 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-sm text-yellow-400 font-semibold mb-1">New order offer</p>
            <p className="text-xs text-gray-400 mb-3">
              You'd earn <span className="text-accent2 font-semibold">${Number(order.pro_earnings ?? 0).toFixed(2)}</span> for this one.
            </p>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={acceptOrder} disabled={updating}>
                {updating ? "..." : "Accept"}
              </button>
              <button className="btn-secondary flex-1 text-red-400" onClick={declineOrder} disabled={updating}>
                Decline
              </button>
            </div>
          </div>
        )}

        {order.pro_accepted && order.status === "pending_payment" && (
          <div className="mt-4 border border-white/10 rounded-lg p-4">
            <p className="text-sm text-gray-300">✅ You accepted this order.</p>
            <p className="text-xs text-gray-500 mt-1">
              Waiting for the client to pay, you'll be able to start and chat with them as soon as that happens.
            </p>
          </div>
        )}

        {order.status === "in_progress" && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <label className="text-sm text-gray-400 mb-2 block">
              Upload proof of completion (screenshot or video) before marking this as delivered.
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) submitEvidence(file);
              }}
              disabled={uploading}
            />
            {uploading && <p className="text-xs text-gray-400 mt-2">Uploading...</p>}
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </div>
        )}

        {order.status === "delivered" && (
          <div className="mt-4 border-t border-white/10 pt-4">
            {order.evidence_url && (
              <a href={order.evidence_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-sm">
                View uploaded evidence →
              </a>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Waiting for the client to confirm. If they don't respond, support can override after 12 hours.
            </p>
          </div>
        )}

        {order.status === "completed" && (
          <p className="text-xs text-gray-500 mt-4">
            Confirmed complete, you'll be paid out on the next 14th or 28th, whichever comes first.
          </p>
        )}
        {order.status === "pro_paid" && (
          <p className="text-accent2 font-semibold mt-4">✅ You've been paid for this order.</p>
        )}
      </div>

      {canWork && (
        <>
          <h2 className="font-semibold mb-2">Chat with client</h2>
          {conversationId ? (
            <Chat conversationId={conversationId} currentUserId={userId} />
          ) : (
            <p className="text-gray-400 text-sm">No chat available for this order yet.</p>
          )}
        </>
      )}
    </div>
  );
}
