import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { orderId, rating, comment } = await req.json();
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, client_id, status").eq("id", orderId).single();
  if (!order || order.client_id !== user.id) {
    return NextResponse.json({ error: "Not your order" }, { status: 403 });
  }
  if (order.status !== "completed") {
    return NextResponse.json({ error: "Order isn't completed yet" }, { status: 400 });
  }

  await admin
    .from("orders")
    .update({ rating: ratingNum, rating_comment: comment || null, rated_at: new Date().toISOString() })
    .eq("id", orderId);

  return NextResponse.json({ ok: true });
}
