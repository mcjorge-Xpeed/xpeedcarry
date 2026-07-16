"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="max-w-sm mx-auto mt-20 card p-8">
      <h1 className="text-xl font-bold mb-4">Sign in</h1>
      {sent ? (
        <p className="text-accent2">We sent a magic link to your email. Check your inbox to sign in.</p>
      ) : (
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="you@email.com"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn-primary" disabled={loading}>
            {loading ? "Sending..." : "Send magic link"}
          </button>
        </form>
      )}
    </div>
  );
}
