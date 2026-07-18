import { createClient } from "@/lib/supabase/server";

export const revalidate = 0;

type OptionItem = { label: string; price: number };
type OptionGroup = { id: string; label: string; type: "radio" | "checkbox"; options: OptionItem[] };

export default async function PricingGuidePage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (me?.role !== "admin" && me?.role !== "support") {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p>You don't have admin permissions.</p>
      </div>
    );
  }

  const { data: games } = await supabase
    .from("games")
    .select("name, slug, base_price, options_config")
    .eq("active", true)
    .order("created_at");

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-2">Pricing Guide (internal)</h1>
      <p className="text-gray-400 text-sm mb-8">
        Reference only, customers never see this. Use it to quote consistently in chat.
      </p>

      <div className="card p-6 mb-8">
        <h2 className="font-semibold mb-3">Universal rules</h2>
        <ul className="text-sm text-gray-300 space-y-2">
          <li>
            • <strong className="text-accent">Self-Play is NOT a flat fee:</strong> it varies based on the order's
            difficulty and how skilled the client actually is (ask in chat, or judge from how they describe
            their goal). A weak player asking for a Self-Play carry takes much more of the pro's time and
            patience than a strong one, so price it up accordingly using the difficulty tiers below,
            treat Self-Play as "Piloted price + difficulty surcharge", not a fixed add-on.
          </li>
          <li>
            • <strong className="text-accent">$5 minimum surcharge, always:</strong> never quote Self-Play at
            the same price as Piloted, no matter how skilled the client claims to be. Even a strong player
            is slower than a pro doing it directly, and this protects the pro if the client's self-assessment
            turns out optimistic.
          </li>
          <li>• <strong className="text-accent">Difficulty multiplier:</strong> start from the game's base numbers below, then scale up based on how hard/time-consuming the specific request is:</li>
        </ul>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: "Easy", mult: "×1", selfplay: "+$5", desc: "Standard, matches the base numbers below" },
            { label: "Medium", mult: "×1.3", selfplay: "+$7–10", desc: "A bit more time/skill than usual" },
            { label: "Hard", mult: "×1.6–2", selfplay: "+$10–15", desc: "Long grind, high risk, tight timeframe" },
            { label: "Extreme", mult: "×2.5+", selfplay: "+$18+", desc: "Rare/hardest content, weak player, use judgment" },
          ].map((tier) => (
            <div key={tier.label} className="border border-white/10 rounded-lg p-3">
              <p className="font-semibold text-sm">{tier.label}</p>
              <p className="text-accent font-bold">{tier.mult}</p>
              <p className="text-xs text-gray-400 mt-1">Self-Play: {tier.selfplay}</p>
              <p className="text-xs text-gray-500 mt-1">{tier.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6 mb-8 border-accent2/20">
        <h2 className="font-semibold mb-3">Evaluating a Self-Play client before quoting</h2>
        <p className="text-sm text-gray-300 mb-3">
          You're setting a price before the pro has actually seen them play, so treat this as an estimate,
          not a guarantee. Ask in chat before confirming price:
        </p>
        <ul className="text-sm text-gray-300 space-y-1 mb-3 list-disc pl-5">
          <li>What's your current level/rank/gear in this game?</li>
          <li>Roughly how many hours have you played it?</li>
          <li>Have you done this specific thing before (this boss, this mode, this content)?</li>
        </ul>
        <p className="text-sm text-gray-300 mb-3">
          <strong className="text-accent">When unsure, round up a tier.</strong> It's much easier to offer a
          small discount afterward than to ask a client for more money mid-order.
        </p>
        <p className="text-sm text-gray-300">
          <strong className="text-accent">If the pro finds the client is significantly weaker than described:</strong>{" "}
          have them stop and message you instead of pushing through or eating the loss. Pause the order, agree
          on a revised price with the client in chat, and only continue once they accept it (this is disclosed
          to clients in the Terms of Service, so it's not a surprise). If they decline, cancel and refund the
          unstarted portion per the Refund Policy.
        </p>
      </div>

      <div className="card p-6 mb-8 border-accent/20">
        <h2 className="font-semibold mb-3">Stripe fees & minimum pricing</h2>
        <p className="text-sm text-gray-300 mb-4">
          Stripe takes roughly <strong className="text-accent">2.9% + $0.30</strong> per card payment
          (this is the standard US online rate, check your actual Stripe Dashboard settings, since it can be
          higher for international cards or a different home country). That $0.30 fixed part hits small
          orders hard: on a $5 order it eats ~9% of the price; on a $50 order it's only ~3.5%.
        </p>
        <p className="text-sm text-gray-300 mb-4">
          <strong className="text-accent">Recommended: don't quote below a $10 total</strong> once you factor
          in Stripe's cut and whatever you pay the pro, anything cheaper barely clears the transaction fee,
          let alone leaves a real margin. When a client asks for something small, either bundle it with
          something else or round up.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[5, 10, 20, 50, 100].map((amount) => {
            const fee = Math.round((amount * 0.029 + 0.3) * 100) / 100;
            const net = Math.round((amount - fee) * 100) / 100;
            return (
              <div key={amount} className="border border-white/10 rounded-lg p-3 text-center">
                <p className="text-sm text-gray-400">${amount} order</p>
                <p className="text-red-400 text-xs mt-1">-${fee.toFixed(2)} fee</p>
                <p className="text-accent2 font-bold mt-1">${net.toFixed(2)} net</p>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          "Net" here is before whatever you pay the pro for the order, this is only the Stripe cut.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {games?.map((g: any) => {
          const groups: OptionGroup[] = g.options_config?.groups ?? [];
          return (
            <div key={g.slug} className="card p-5">
              <h2 className="font-semibold mb-1">{g.name}</h2>
              <p className="text-xs text-gray-400 mb-4">Base / platform fee: ${g.base_price}</p>
              {groups.length === 0 ? (
                <p className="text-sm text-gray-500">No reference prices set for this game yet.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {groups.map((group) => (
                    <div key={group.id}>
                      <p className="text-xs uppercase tracking-wide text-accent font-bold mb-2">{group.label}</p>
                      <ul className="text-sm space-y-1">
                        {group.options.map((opt) => (
                          <li key={opt.label} className="flex justify-between gap-3 text-gray-300">
                            <span>{opt.label}</span>
                            <span className="text-accent2 font-semibold whitespace-nowrap">
                              {opt.price === 0 ? "base" : `+$${opt.price.toFixed(2)}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
