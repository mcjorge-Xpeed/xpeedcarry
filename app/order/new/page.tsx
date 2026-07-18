"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Game = {
  id: string;
  name: string;
  slug: string;
};

function NewOrderForm() {
  const searchParams = useSearchParams();
  const gameSlug = searchParams.get("game") || "";

  const [game, setGame] = useState<Game | null>(null);
  const [loadingGame, setLoadingGame] = useState(!!gameSlug);

  const [serviceMode, setServiceMode] = useState<"piloted" | "selfplay">("piloted");
  const [device, setDevice] = useState("PC");
  const [description, setDescription] = useState("");

  // Nintendo only makes sense for a true Custom Order (no specific game),
  // since none of the catalog games are on Switch, only offer it there.
  const deviceOptions = game ? ["PC", "PlayStation", "Xbox"] : ["PC", "PlayStation", "Xbox", "Nintendo"];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  useEffect(() => {
    if (!gameSlug) return;
    (async () => {
      const { data } = await supabase.from("games").select("id, name, slug").eq("slug", gameSlug).single();
      setGame(data as Game);
      setLoadingGame(false);
    })();
  }, [gameSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("You need to sign in before creating an order.");
      setLoading(false);
      window.location.href = "/login";
      return;
    }

    const modeLabel = serviceMode === "piloted" ? "Piloted" : "Self-Play";
    const title = game ? `${game.name}: ${modeLabel}` : `Custom Order: ${modeLabel}`;
    const fullDescription = `Service mode: ${modeLabel}\nDevice: ${device}\n\n${description}`;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        client_id: user.id,
        game_id: game?.id ?? null,
        is_custom: !game,
        title,
        description: fullDescription,
        price: 0,
        price_confirmed: false,
      })
      .select()
      .single();

    if (orderError || !order) {
      setError(orderError?.message ?? "Couldn't create the order.");
      setLoading(false);
      return;
    }

    await supabase.from("conversations").insert({
      type: "order",
      order_id: order.id,
      client_id: user.id,
    });

    window.location.href = `/order/${order.id}`;
  }

  if (gameSlug && loadingGame) {
    return <p className="text-center mt-20 text-gray-400">Loading...</p>;
  }

  return (
    <div className="max-w-lg mx-auto mt-10 card p-8">
      <h1 className="text-xl font-bold mb-1">{game ? `${game.name} Order` : "Custom Order"}</h1>
      <p className="text-sm text-gray-400 mb-6">
        Choose how you want it done, tell us what you need, and support will confirm the final price
        with you in chat before you pay.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Service Mode</label>
          <div className="grid grid-cols-2 gap-3">
            {(["piloted", "selfplay"] as const).map((mode) => (
              <label key={mode} className={`choice-card ${serviceMode === mode ? "active" : ""}`}>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="service-mode"
                    checked={serviceMode === mode}
                    onChange={() => setServiceMode(mode)}
                    className="accent-[#8b5cf6]"
                  />
                  <span className="text-sm font-semibold">{mode === "piloted" ? "Piloted" : "Self-Play"}</span>
                  {mode === "selfplay" && <span className="text-xs text-gray-500">(price varies)</span>}
                </div>
                <span className="relative group">
                  <span className="w-4 h-4 rounded-full border border-accent/40 text-accent text-[10px] flex items-center justify-center cursor-help">?</span>
                  <span className="info-tooltip hidden group-hover:block">
                    {mode === "piloted"
                      ? "A pro logs into your account and completes the order for you."
                      : "Play alongside a pro in a duo session. Price depends on your skill level and how difficult the order is, support will confirm it with you."}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Device</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {deviceOptions.map((d) => (
              <label key={d} className={`choice-card justify-center ${device === d ? "active" : ""}`}>
                <input
                  type="radio"
                  name="device"
                  className="sr-only"
                  checked={device === d}
                  onChange={() => setDevice(d)}
                />
                <span className="text-sm font-semibold">{d}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm text-gray-400">What do you need?</label>
          <textarea
            className="input"
            rows={4}
            required
            placeholder={
              game
                ? `E.g.: Level 1-70, specific missions, timeframe you're available...`
                : "E.g.: Level 1-70 in Diablo 4, account X, available hours..."
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button className="btn-primary" disabled={loading}>
          {loading ? "Sending..." : "Send Request & Get Price"}
        </button>
      </form>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={null}>
      <NewOrderForm />
    </Suspense>
  );
}
