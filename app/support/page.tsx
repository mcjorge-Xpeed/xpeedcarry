"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Chat from "@/components/Chat";

export default function SupportPage() {
  const searchParams = useSearchParams();
  const prefill = searchParams.get("message") ?? undefined;

  const [userId, setUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setUserId(user.id);

      // Check if a support conversation already exists for this client
      // (order by oldest first + limit 1 instead of .maybeSingle(), which
      // errors out if more than one row matches)
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("type", "support")
        .eq("client_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      if (existing && existing.length > 0) {
        setConversationId(existing[0].id);
      } else {
        const { data: created } = await supabase
          .from("conversations")
          .insert({ type: "support", client_id: user.id })
          .select("id")
          .single();
        setConversationId(created?.id ?? null);
      }
      setLoading(false);
    }
    init();
  }, []);

  if (loading) return <p className="text-center mt-20">Loading support chat...</p>;

  return (
    <div className="max-w-xl mx-auto mt-10 px-4">
      <h1 className="text-xl font-bold mb-4">Support Chat</h1>
      {conversationId && userId && (
        <Chat conversationId={conversationId} currentUserId={userId} initialMessage={prefill} />
      )}
    </div>
  );
}
