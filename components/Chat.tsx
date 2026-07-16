"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parsePaymentRequestMessage } from "@/lib/paymentMessage";
import { redirectToCheckout } from "@/lib/checkout";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function PaymentRequestBubble({
  content,
  isOwn,
  currentUserId,
}: {
  content: string;
  isOwn: boolean;
  currentUserId: string;
}) {
  const payload = parsePaymentRequestMessage(content)!;
  const [loading, setLoading] = useState(false);
  const isClient = currentUserId === payload.clientId;

  return (
    <div className={`max-w-[85%] rounded-2xl border border-accent/30 bg-gradient-to-br from-[#1a1030] to-[#121018] p-4 ${isOwn ? "ml-auto" : ""}`}>
      <p className="text-xs uppercase tracking-widest text-accent font-bold mb-1">Payment Request</p>
      <p className="text-sm text-gray-300">{payload.orderNumber} — {payload.title}</p>
      <p className="text-2xl font-bold text-accent2 mt-1 mb-3">${payload.price.toFixed(2)}</p>
      {isClient ? (
        <button
          className="btn-primary w-full text-sm"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            await redirectToCheckout(payload.orderId);
            setLoading(false);
          }}
        >
          {loading ? "Redirecting..." : `Pay $${payload.price.toFixed(2)} Now`}
        </button>
      ) : (
        <p className="text-xs text-gray-500">Waiting for the client to pay.</p>
      )}
    </div>
  );
}

export default function Chat({
  conversationId,
  currentUserId,
  initialMessage,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessage?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const sentInitialFor = useRef<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at");
      setMessages(data ?? []);

      if ((data?.length ?? 0) === 0 && initialMessage && sentInitialFor.current !== conversationId) {
        sentInitialFor.current = conversationId;
        const { data: inserted } = await supabase
          .from("messages")
          .insert({ conversation_id: conversationId, sender_id: currentUserId, content: initialMessage })
          .select()
          .single();
        if (inserted) setMessages([inserted as Message]);
      }
    }
    load();

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: text.trim(),
    });
    setText("");
  }

  return (
    <div className="card flex flex-col h-[480px] overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0d0d10]">
        {messages.map((m) => {
          const isOwn = m.sender_id === currentUserId;
          const isPaymentRequest = m.content.startsWith("::PAYMENT_REQUEST::");

          if (isPaymentRequest) {
            return (
              <div key={m.id} className="flex flex-col">
                <PaymentRequestBubble content={m.content} isOwn={isOwn} currentUserId={currentUserId} />
              </div>
            );
          }

          return (
            <div key={m.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] px-3 py-2 text-sm shadow-sm ${
                  isOwn
                    ? "bg-gradient-to-br from-accent2 to-accent text-[#0a0a0f] font-medium rounded-2xl rounded-br-sm"
                    : "bg-[#1c1c22] text-gray-100 rounded-2xl rounded-bl-sm"
                }`}
              >
                <p className="whitespace-pre-line break-words">{m.content}</p>
                <p className={`text-[10px] mt-1 text-right ${isOwn ? "text-[#0a0a0f]/60" : "text-gray-500"}`}>
                  {formatTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={sendMessage} className="flex gap-2 p-3 border-t border-white/10 bg-[#121018]">
        <input
          className="input"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-primary rounded-full w-10 h-10 flex items-center justify-center p-0" aria-label="Send">
          ➤
        </button>
      </form>
    </div>
  );
}
