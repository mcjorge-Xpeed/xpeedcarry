"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { redirectToCheckout } from "@/lib/checkout";
import Chat from "@/components/Chat";
import TermsGateModal from "@/components/TermsGateModal";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [order, setOrder] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function init() {
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
    init();
  }, [id]);

  async function confirmCompletion() {
    setConfirming(true);
    await supabase
      .from("orders")
      .update({ status: "completed", confirmed_by: "client" })
      .eq("id", id);
    const { data: orderData } = await supabase.from("orders").select("*").eq("id", id).single();
    setOrder(orderData);
    setConfirming(false);
  }

  if (!order) return <p className="text-center mt-20">Loading order...</p>;

  const statusLabels: Record<string, string> = {
    pending_payment: "Pending payment",
    paid: "Paid - finding a pro",
    assigned: "Pro assigned",
    in_progress: "In progress",
    delivered: "Delivered, please confirm",
    completed: "Completed",
    pro_paid: "Pro paid",
    cancelled: "Cancelled",
  };

  const awaitingQuote = order.status === "pending_payment" && !order.price_confirmed;
  const readyToPay = order.status === "pending_payment" && order.price_confirmed;

  return (
    <div className="max-w-2xl mx-auto mt-10 px-4">
      <div className="card p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-gray-400">{order.order_number}</p>
            <h1 className="text-xl font-bold">{order.title}</h1>
          </div>
          <span className="text-accent2 text-sm font-semibold">{statusLabels[order.status]}</span>
        </div>
        <p className="text-gray-400 text-sm mt-2 whitespace-pre-line">{order.description}</p>
        <p className="mt-3 font-bold">
          {awaitingQuote ? "Price pending, chat with support below" : `$${order.price}`}
        </p>

        {readyToPay && (
          <div className="mt-4">
            <button className="btn-primary w-full" onClick={() => setShowTerms(true)}>
              {`Pay $${order.price} Now`}
            </button>
          </div>
        )}

        {order.status === "delivered" && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-sm text-gray-300 mb-2">Your pro says this order is done. Please review:</p>
            {(order.evidence_urls ?? []).length > 0 && (
              <div className="flex flex-col gap-1 mb-3">
                {order.evidence_urls.map((url: string, i: number) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline text-sm block"
                  >
                    View proof of completion {order.evidence_urls.length > 1 ? `#${i + 1}` : ""} →
                  </a>
                ))}
              </div>
            )}
            <button className="btn-primary w-full" onClick={confirmCompletion} disabled={confirming}>
              {confirming ? "Confirming..." : "Confirm & Release"}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Something wrong? Reply in the chat below instead of confirming.
            </p>
          </div>
        )}
      </div>

      <h2 className="font-semibold mb-2">{awaitingQuote ? "Chat with Support" : "Chat with your pro"}</h2>
      {conversationId && userId ? (
        <Chat conversationId={conversationId} currentUserId={userId} />
      ) : (
        <p className="text-gray-400 text-sm">
          The chat activates as soon as payment is confirmed and a pro is assigned.
        </p>
      )}

      {showTerms && (
        <TermsGateModal
          price={order.price}
          onClose={() => setShowTerms(false)}
          onConfirm={() => redirectToCheckout(order.id)}
        />
      )}
    </div>
  );
}
