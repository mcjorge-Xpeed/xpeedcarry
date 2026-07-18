import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { orderId, accept } = await req.json();
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, pro_id, status").eq("id", orderId).single();
  if (!order || order.pro_id !== user.id) {
    return NextResponse.json({ error: "Not your order" }, { status: 403 });
  }

  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("order_id", orderId)
    .eq("type", "order")
    .maybeSingle();

  if (accept) {
    const updates: Record<string, any> = { pro_accepted: true };
    const alreadyPaid = order.status !== "pending_payment";
    if (alreadyPaid) updates.status = "in_progress";
    await admin.from("orders").update(updates).eq("id", orderId);

    // If payment already landed by the time we accept, unlock the chat now
    // (mirrors what the Stripe webhook does when the pro accepts BEFORE
    // payment: conversations.pro_id is what actually gates chat access).
    if (alreadyPaid && conv) {
      await admin.from("conversations").update({ pro_id: user.id }).eq("id", conv.id);
    }
  } else {
    await admin.from("orders").update({ pro_id: null, pro_accepted: false }).eq("id", orderId);
    if (conv) {
      await admin.from("conversations").update({ pro_id: null }).eq("id", conv.id);
    }
  }

  return NextResponse.json({ ok: true });
}
