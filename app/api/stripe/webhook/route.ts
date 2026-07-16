import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook inválido: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;

    if (orderId) {
      const supabase = createAdminClient();
      // Esto dispara el trigger de la BD que fija paid_at y pro_payout_due_at (+7 días)
      await supabase
        .from("orders")
        .update({
          status: "paid",
          stripe_payment_intent: session.payment_intent as string,
        })
        .eq("id", orderId);

      // Crea automáticamente la conversación de la orden (cliente <-> pro, se asigna pro después)
      const { data: order } = await supabase.from("orders").select("client_id").eq("id", orderId).single();
      if (order) {
        await supabase.from("conversations").insert({
          type: "order",
          order_id: orderId,
          client_id: order.client_id,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
