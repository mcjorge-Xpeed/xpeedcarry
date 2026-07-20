"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function HiringToggle() {
  const [hiringOpen, setHiringOpen] = useState<boolean | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("hiring_open")
      .eq("id", 1)
      .single()
      .then(({ data }) => setHiringOpen(!!data?.hiring_open));
  }, []);

  async function toggle() {
    const next = !hiringOpen;
    setHiringOpen(next);
    await supabase.from("site_settings").update({ hiring_open: next }).eq("id", 1);
  }

  if (hiringOpen === null) return null;

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
        hiringOpen ? "border-green-400 text-green-400 bg-green-400/10" : "border-white/10 text-gray-500"
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${hiringOpen ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
      Hiring: {hiringOpen ? "ON" : "OFF"}
    </button>
  );
}
