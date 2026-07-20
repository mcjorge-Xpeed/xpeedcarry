import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";

export const revalidate = 0;

export default async function HomePage() {
  const supabase = createClient();
  const { data: games } = await supabase
    .from("games")
    .select("*")
    .eq("active", true)
    .order("created_at");

  const { data: testimonials } = await supabase
    .from("public_testimonials")
    .select("*")
    .order("rated_at", { ascending: false })
    .limit(6);

  return (
    <div>
      <section className="hero-gradient px-6 pt-24 pb-20 text-center relative overflow-hidden">
        <div className="max-w-3xl mx-auto relative">
          <span className="badge-pill mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent2 animate-pulse" />
            Leveling & progression specialists
          </span>
          <h1 className="text-4xl sm:text-6xl font-bold mb-5 leading-[1.08]">
            Level up fast.<br />
            <span className="gradient-text">Play more, grind less.</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-lg">
            We handle the grind so you can enjoy the game. Real players, secure payments,
            and a direct chat with your pro every step of the way.
          </p>
          <div className="flex gap-4 justify-center mt-9">
            <Link href="#games" className="btn-primary">
              Browse Games
            </Link>
            <Link href="/order/new" className="btn-secondary">
              Custom Order
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center mt-14 relative">
          <span className="badge-pill">🔒 Secure Stripe Checkout</span>
          <span className="badge-pill">💬 Direct chat with your pro</span>
          <span className="badge-pill">🎯 Tailored to every client</span>
          <span className="badge-pill">🕒 24/7 support</span>
        </div>
      </section>

      <section id="games" className="px-6 py-16 max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-accent2">Catalog</span>
            <h2 className="text-2xl sm:text-3xl font-bold mt-1">Popular Games</h2>
            <p className="text-gray-400 text-sm mt-1">Fast leveling packages for the games everyone's playing right now.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {games?.map((game) => (
            <Link key={game.id} href={`/order/new?game=${game.slug}`} className="game-card group">
              <div className="relative h-44 w-full">
                <Image src={game.image_url} alt={game.name} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121018] via-transparent to-transparent" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg">{game.name}</h3>
                <p className="text-sm text-gray-400 line-clamp-2 mt-1">{game.description}</p>
                <p className="mt-3 text-accent2 font-bold flex items-center gap-1">
                  Get a Quote <span className="transition-transform group-hover:translate-x-1">→</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-6 py-16 max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-accent2">Simple process</span>
          <h2 className="text-2xl sm:text-3xl font-bold mt-1">How It Works</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: "1", title: "Tell us what you need", desc: "Pick Piloted or Self-Play and describe your goal." },
            { step: "2", title: "Confirm your price", desc: "Chat with support, no surprises, no obligation." },
            { step: "3", title: "Pay securely", desc: "Stripe Checkout. We never see your card details." },
            { step: "4", title: "Track it in chat", desc: "Your pro gets to work, follow along live." },
          ].map((s) => (
            <div key={s.step} className="card p-6 text-center hover:-translate-y-1 transition-transform">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gradient-to-br from-accent to-accent2 flex items-center justify-center font-bold text-[#07070d]">
                {s.step}
              </div>
              <h3 className="font-semibold mb-1">{s.title}</h3>
              <p className="text-sm text-gray-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {testimonials && testimonials.length > 0 && (
        <section className="px-6 py-16 max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-accent2">Reviews</span>
            <h2 className="text-2xl sm:text-3xl font-bold mt-1">What Our Clients Say</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t) => {
              const initial = t.client_name ? `${t.client_name.split(" ")[0]} ${t.client_name.split(" ")[1]?.[0] ?? ""}.` : "Verified Client";
              return (
                <div key={t.id} className="card p-6">
                  <p className="text-yellow-400 mb-2">{"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}</p>
                  {t.rating_comment && <p className="text-sm text-gray-300 mb-3">"{t.rating_comment}"</p>}
                  <p className="text-xs text-gray-500">{initial}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="px-6 py-16 max-w-6xl mx-auto">
        <div className="card p-8 sm:p-12 text-center hero-gradient">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Don't see your game?</h2>
          <p className="text-gray-400 max-w-lg mx-auto mb-6">
            Tell us what you need and we'll build a custom order for it: any game, any goal.
          </p>
          <Link href="/order/new" className="btn-primary inline-block">
            Create Custom Order
          </Link>
        </div>
      </section>
    </div>
  );
}
