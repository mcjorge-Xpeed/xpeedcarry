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

    const { data: orderData } = await supabase.from("orders").select("*").eq("id", id).single();
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

  async function startOrder() {
    setUpdating(true);
    await supabase.from("orders").update({ status: "in_progress" }).eq("id", id);
    setUpdating(false);
    load();
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
    assigned: "Assigned — not started",
    in_progress: "In progress",
    delivered: "Delivered — waiting for client to confirm",
    completed: "Completed — awaiting payout",
    pro_paid: "Paid out",
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 px-4">
      <div className="card p-6 mb-6">
        <p className="text-sm text-gray-400">{order.order_number}</p>
        <h1 className="text-xl font-bold">{order.title}</h1>
        <p className="text-gray-400 text-sm mt-2 whitespace-pre-line">{order.description}</p>
        <p className="mt-3 font-bold">${order.price} — {statusLabels[order.status] ?? order.status}</p>

        {order.status === "assigned" && (
          <button className="btn-primary w-full mt-4" onClick={startOrder} disabled={updating}>
            {updating ? "Starting..." : "Start Order"}
          </button>
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
            Confirmed complete — you'll be paid out on the next 14th or 28th, whichever comes first.
          </p>
        )}
        {order.status === "pro_paid" && (
          <p className="text-accent2 font-semibold mt-4">✅ You've been paid for this order.</p>
        )}
      </div>

      <h2 className="font-semibold mb-2">Chat with client</h2>
      {conversationId ? (
        <Chat conversationId={conversationId} currentUserId={userId} />
      ) : (
        <p className="text-gray-400 text-sm">No chat available for this order yet.</p>
      )}
    </div>
  );
}
