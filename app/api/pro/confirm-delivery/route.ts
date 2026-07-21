import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { orderId, evidenceUrls } = await req.json();
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!Array.isArray(evidenceUrls) || evidenceUrls.length === 0) {
    return NextResponse.json({ error: "At least one evidence file is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, pro_id, status").eq("id", orderId).single();
  if (!order || order.pro_id !== user.id) {
    return NextResponse.json({ error: "Not your order" }, { status: 403 });
  }
  if (order.status !== "in_progress") {
    return NextResponse.json({ error: "Order isn't in progress" }, { status: 400 });
  }

  await admin
    .from("orders")
    .update({ status: "delivered", delivered_at: new Date().toISOString(), evidence_urls: evidenceUrls })
    .eq("id", orderId);

  return NextResponse.json({ ok: true });
}
