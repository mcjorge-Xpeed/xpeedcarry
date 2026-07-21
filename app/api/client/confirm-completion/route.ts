import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { orderId } = await req.json();
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, client_id, status").eq("id", orderId).single();
  if (!order || order.client_id !== user.id) {
    return NextResponse.json({ error: "Not your order" }, { status: 403 });
  }
  if (order.status !== "delivered") {
    return NextResponse.json({ error: "Order isn't awaiting confirmation" }, { status: 400 });
  }

  await admin.from("orders").update({ status: "completed", confirmed_by: "client" }).eq("id", orderId);

  return NextResponse.json({ ok: true });
}
