"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Chat from "@/components/Chat";
import PricingGuideSidebar from "@/components/PricingGuideSidebar";

export default function AdminSupportChat() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState<boolean | null>(null);
  const [clientName, setClientName] = useState<string>("");
  const [closing, setClosing] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setAdminId(user?.id ?? null);

      const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
      setIsStaff(me?.role === "admin" || me?.role === "support");

      const { data: conv } = await supabase
        .from("conversations")
        .select("client:client_id(full_name)")
        .eq("id", id)
        .single();
      setClientName((conv as any)?.client?.full_name ?? "Client");
    })();
  }, [id]);

  async function closeChat() {
    setClosing(true);
    await supabase.from("conversations").update({ closed: true }).eq("id", id);
    router.push("/admin");
  }

  if (!adminId || isStaff === null) return <p className="text-center mt-20">Loading...</p>;

  if (!isStaff) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p>You don't have admin permissions.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-10 px-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Support Chat: {clientName}</h1>
        <button className="btn-secondary text-sm" onClick={closeChat} disabled={closing}>
          {closing ? "Closing..." : "Close Chat"}
        </button>
      </div>
      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <Chat conversationId={id} currentUserId={adminId} />
        <PricingGuideSidebar />
      </div>
    </div>
  );
}
