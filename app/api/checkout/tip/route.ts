import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { orderId, amount } = await req.json();
  const supabase = createClient();

  const tipAmount = Number(amount);
  if (!tipAmount || tipAmount < 1) {
    return NextResponse.json({ error: "Invalid tip amount" }, { status: 400 });
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, title, status")
    .eq("id", orderId)
    .single();

  if (error || !order || order.status !== "completed") {
    return NextResponse.json({ error: "Order not found or not completed" }, { status: 404 });
  }

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `Tip for ${order.title}` },
          unit_amount: Math.round(tipAmount * 100),
        },
        quantity: 1,
      },
    ],
    metadata: { order_id: order.id, type: "tip" },
    success_url: `${origin}/order/${order.id}?tipped=1`,
    cancel_url: `${origin}/order/${order.id}?tipped=0`,
  });

  return NextResponse.json({ url: session.url });
}
