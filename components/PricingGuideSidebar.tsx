"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type OptionItem = { label: string; price: number };
type OptionGroup = { id: string; label: string; type: "radio" | "checkbox"; options: OptionItem[] };
type Game = { name: string; slug: string; base_price: number; options_config: { groups?: OptionGroup[] } };

const TIERS = [
  { label: "Easy", mult: "×1", selfplay: "+$3" },
  { label: "Medium", mult: "×1.3", selfplay: "+$5–7" },
  { label: "Hard", mult: "×1.6–2", selfplay: "+$8–12" },
  { label: "Extreme", mult: "×2.5+", selfplay: "+$15+" },
];

export default function PricingGuideSidebar() {
  const [open, setOpen] = useState(true);
  const [games, setGames] = useState<Game[]>([]);
  const [openGame, setOpenGame] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("games")
      .select("name, slug, base_price, options_config")
      .eq("active", true)
      .order("created_at")
      .then(({ data }) => setGames((data as Game[]) ?? []));
  }, []);

  return (
    <div className="card p-4 lg:sticky lg:top-20 h-fit">
      <button
        className="w-full flex items-center justify-between font-semibold text-sm"
        onClick={() => setOpen((o) => !o)}
      >
        <span>💲 Pricing Guide <span className="text-gray-500 font-normal">(internal only)</span></span>
        <span className="text-gray-500">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="border border-white/10 rounded-lg p-3">
            <p className="text-xs font-bold text-accent uppercase tracking-wide mb-2">Difficulty tiers</p>
            <div className="grid grid-cols-2 gap-2">
              {TIERS.map((t) => (
                <div key={t.label} className="text-xs">
                  <p className="font-semibold">{t.label} <span className="text-accent">{t.mult}</span></p>
                  <p className="text-gray-400">Self-Play {t.selfplay}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              Self-Play = Piloted price + surcharge above, judged by skill/difficulty. Never quote below $10 total.
            </p>
          </div>

          {games.map((g) => (
            <div key={g.slug} className="border border-white/10 rounded-lg">
              <button
                className="w-full flex items-center justify-between p-3 text-sm font-semibold"
                onClick={() => setOpenGame(openGame === g.slug ? null : g.slug)}
              >
                <span>{g.name}</span>
                <span className="text-gray-500 text-xs">{openGame === g.slug ? "▾" : "▸"}</span>
              </button>
              {openGame === g.slug && (
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-[11px] text-gray-500">Base fee: ${g.base_price}</p>
                  {(g.options_config?.groups ?? []).map((group) => (
                    <div key={group.id}>
                      <p className="text-[11px] uppercase tracking-wide text-accent font-bold mb-1">{group.label}</p>
                      <ul className="text-xs space-y-1">
                        {group.options.map((opt) => (
                          <li key={opt.label} className="flex justify-between gap-2 text-gray-300">
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
          ))}
        </div>
      )}
    </div>
  );
}
