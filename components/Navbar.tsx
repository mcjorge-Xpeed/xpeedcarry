"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type Game = { id: string; name: string; slug: string; image_url: string };

export default function Navbar() {
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const supabase = createClient();

  async function loadRole(userId: string) {
    const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
    setRole(data?.role ?? null);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      if (data.user) loadRole(data.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
      if (session?.user) loadRole(session.user.id);
      else setRole(null);
    });

    supabase
      .from("games")
      .select("id, name, slug, image_url")
      .eq("active", true)
      .order("created_at")
      .then(({ data }) => setGames((data as Game[]) ?? []));

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <nav className="sticky top-0 z-50 backdrop-blur bg-[#07070d]/85 border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Image src="/logo.svg" alt="XpeedCarry" width={34} height={34} />
          Xpeed<span className="text-accent">carry</span>
        </Link>
        <div className="flex gap-6 items-center text-sm">
          <div
            className="relative hidden sm:block"
            onMouseEnter={() => setGamesOpen(true)}
            onMouseLeave={() => setGamesOpen(false)}
          >
            <button className="hover:text-accent2 transition flex items-center gap-1">
              Games
              <span className="text-[10px]">▾</span>
            </button>
            {gamesOpen && games.length > 0 && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-[560px] card p-3 shadow-xl grid grid-cols-2 gap-1">
                {games.map((g) => (
                  <Link
                    key={g.id}
                    href={`/order/new?game=${g.slug}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition"
                  >
                    <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
                      <Image src={g.image_url} alt={g.name} fill className="object-cover" />
                    </div>
                    <span className="text-sm">{g.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link href="/order/new" className="hidden sm:inline hover:text-accent2 transition">
            Custom Order
          </Link>
          <Link href="/support" className="hidden sm:inline hover:text-accent2 transition">
            Support
          </Link>

          {email ? (
            <div className="relative">
              <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-2 bg-[#121018] border border-white/10 rounded-full pl-1 pr-3 py-1 hover:border-accent transition"
              >
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-xs font-bold">
                  {email[0].toUpperCase()}
                </span>
                <span className="max-w-[120px] truncate">{email}</span>
              </button>
              {open && (
                <div className="absolute right-0 mt-2 w-48 card p-2 text-sm shadow-xl">
                  <p className="px-3 py-2 text-gray-400 text-xs">Signed in</p>
                  <Link href="/order/new" className="block px-3 py-2 rounded hover:bg-white/5">
                    My Orders
                  </Link>
                  {role === "pro" && (
                    <Link href="/pro" className="block px-3 py-2 rounded hover:bg-white/5">
                      Pro Dashboard
                    </Link>
                  )}
                  {role === "admin" && (
                    <Link href="/admin" className="block px-3 py-2 rounded hover:bg-white/5">
                      Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 rounded hover:bg-white/5 text-red-400"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="btn-primary text-sm">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
