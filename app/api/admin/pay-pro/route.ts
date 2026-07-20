import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { orderIds, transferFee } = await req.json();
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "No orders given" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: orders, error: fetchError } = await admin
    .from("orders")
    .select("id, order_number, pro_id, pro_earnings, tip_pro_payout")
    .in("id", orderIds)
    .eq("payout_withheld", false);

  if (fetchError || !orders || orders.length === 0) {
    return NextResponse.json({ error: "Orders not found" }, { status: 404 });
  }

  const proId = orders[0].pro_id;
  const grossTotal = orders.reduce(
    (sum, o) => sum + Number(o.pro_earnings ?? 0) + Number(o.tip_pro_payout ?? 0),
    0
  );
  const fee = Math.max(0, Number(transferFee) || 0);
  const netTotal = Math.round((grossTotal - fee) * 100) / 100;

  // Split the transfer fee proportionally across each order by its share of
  // the total payout, so each order keeps an accurate net-paid record.
  for (const o of orders) {
    const orderGross = Number(o.pro_earnings ?? 0) + Number(o.tip_pro_payout ?? 0);
    const share = grossTotal > 0 ? orderGross / grossTotal : 0;
    const orderFee = Math.round(fee * share * 100) / 100;
    await admin
      .from("orders")
      .update({
        status: "pro_paid",
        pro_paid_at: new Date().toISOString(),
        pro_paid_by: user.id,
        pro_payout_fee: orderFee,
      })
      .eq("id", o.id);
  }

  if (process.env.RESEND_API_KEY) {
    const { data: proUser } = await admin.auth.admin.getUserById(proId);
    const proEmail = proUser?.user?.email;

    if (proEmail) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "XpeedCarry Payroll <noreply@xpeedcarry.net>",
          to: proEmail,
          subject: `You've been paid: $${netTotal.toFixed(2)}`,
          html: `
            <p>Hi,</p>
            <p>Your payout for ${orders.length} completed order(s) has just been sent.</p>
            <p><strong>Net amount transferred: $${netTotal.toFixed(2)}</strong>${
              fee > 0 ? ` (after a $${fee.toFixed(2)} transfer fee)` : ""
            }</p>
            <p>Orders: ${orders.map((o) => o.order_number).join(", ")}</p>
            <p>- XpeedCarry</p>
          `,
        }),
      });
    }
  }

  return NextResponse.json({ ok: true, netTotal });
}
