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

      const { data: order } = await supabase
        .from("orders")
        .select("client_id, pro_id, pro_accepted")
        .eq("id", orderId)
        .single();

      // Si el pro ya había aceptado la oferta antes de que se pagara, arranca
      // directo a "in_progress": la promesa del negocio es que el cliente
      // paga sabiendo que el pro ya está listo, sin esperar más pasos.
      const readyProId = order?.pro_id && order?.pro_accepted ? order.pro_id : null;

      // Esto dispara el trigger de la BD que fija paid_at y pro_payout_due_at (+7 días)
      await supabase
        .from("orders")
        .update({
          status: readyProId ? "in_progress" : "paid",
          stripe_payment_intent: session.payment_intent as string,
        })
        .eq("id", orderId);

      // La conversación de la orden ya se crea cuando el cliente arma el pedido
      // (antes de pagar, para poder negociar el precio), solo la creamos acá
      // como respaldo, por si por algún motivo no existiera todavía.
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("order_id", orderId)
        .eq("type", "order")
        .maybeSingle();

      if (!existingConv && order) {
        await supabase.from("conversations").insert({
          type: "order",
          order_id: orderId,
          client_id: order.client_id,
          pro_id: readyProId,
        });
      } else if (existingConv && readyProId) {
        // Solo ahora, con el pago confirmado, el pro gana acceso al chat.
        await supabase.from("conversations").update({ pro_id: readyProId }).eq("id", existingConv.id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
