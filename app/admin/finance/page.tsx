"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STRIPE_PCT = 0.029;
const STRIPE_FIXED = 0.3;

function stripeFee(amount: number) {
  return Math.round((amount * STRIPE_PCT + STRIPE_FIXED) * 100) / 100;
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const duration = 500;
    let frame: number;

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      setDisplayed(from + (to - from) * t);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>${displayed.toFixed(2)}</>;
}

type CardProps = { emoji: string; label: string; value: number; color: string };

function FinanceCard({ emoji, label, value, color }: CardProps) {
  return (
    <div className="card p-5">
      <p className="text-gray-400 text-sm mb-1">
        {emoji} {label}
      </p>
      <p className={`text-3xl font-bold ${color}`}>
        <AnimatedNumber value={value} />
      </p>
    </div>
  );
}

export default function FinancePage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [revenue, setRevenue] = useState(0);
  const [stripeFees, setStripeFees] = useState(0);
  const [paidToPros, setPaidToPros] = useState(0);
  const [reserveBalance, setReserveBalance] = useState(0);
  const [ledger, setLedger] = useState<any[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
    if (me?.role !== "admin") {
      setIsAdmin(false);
      return;
    }
    setIsAdmin(true);

    const { data: orders } = await supabase
      .from("orders")
      .select("price, status, pro_earnings")
      .not("status", "in", "(pending_payment,cancelled)");

    let rev = 0;
    let fees = 0;
    let pros = 0;
    for (const o of orders ?? []) {
      const price = Number(o.price) || 0;
      rev += price;
      fees += stripeFee(price);
      if (o.status === "pro_paid") pros += Number(o.pro_earnings) || 0;
    }
    setRevenue(Math.round(rev * 100) / 100);
    setStripeFees(Math.round(fees * 100) / 100);
    setPaidToPros(Math.round(pros * 100) / 100);

    const { data: ledgerRows } = await supabase
      .from("reserve_fund_ledger")
      .select("*")
      .order("created_at", { ascending: false });
    setLedger(ledgerRows ?? []);

    const balance = (ledgerRows ?? []).reduce(
      (sum, row) => sum + (row.type === "withdrawal" ? -Number(row.amount) : Number(row.amount)),
      0
    );
    setReserveBalance(Math.round(balance * 100) / 100);
  }

  useEffect(() => {
    load();

    const channel = supabase
      .channel("finance-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reserve_fund_ledger" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const reserveContributions = ledger
    .filter((r) => r.type === "contribution")
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const netMargin = Math.round((revenue - stripeFees - paidToPros - reserveContributions) * 100) / 100;

  async function submitWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) return;
    setSubmitting(true);
    await supabase.from("reserve_fund_ledger").insert({
      type: "withdrawal",
      amount,
      note: withdrawNote || null,
    });
    setWithdrawAmount("");
    setWithdrawNote("");
    setSubmitting(false);
    load();
  }

  if (isAdmin === null) return <p className="text-center mt-20">Loading...</p>;

  if (isAdmin === false) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p>You don't have admin permissions.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-2">Finance</h1>
      <p className="text-gray-400 text-sm mb-8">
        Live overview, updates automatically as orders move. Admin-only.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <FinanceCard emoji="💰" label="Total Revenue" value={revenue} color="text-accent2" />
        <FinanceCard emoji="🏦" label="Stripe Fees" value={stripeFees} color="text-red-400" />
        <FinanceCard emoji="🎮" label="Paid to Pros" value={paidToPros} color="text-sky-400" />
        <FinanceCard emoji="🛡️" label="Reserve Fund Balance" value={reserveBalance} color="text-accent2" />
        <FinanceCard emoji="📈" label="Your Net Margin" value={netMargin} color="text-accent" />
      </div>

      <div className="card p-5 mb-8">
        <h2 className="font-semibold mb-3">Log a reserve fund withdrawal</h2>
        <p className="text-xs text-gray-500 mb-3">
          Use this when you actually use the reserve fund to cover a real claim/chargeback loss.
        </p>
        <form onSubmit={submitWithdrawal} className="flex flex-col sm:flex-row gap-2">
          <input
            type="number"
            min={0.01}
            step="0.01"
            placeholder="Amount"
            className="input sm:w-32"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
          />
          <input
            type="text"
            placeholder="Note (e.g. order ORD26-1042 chargeback)"
            className="input flex-1"
            value={withdrawNote}
            onChange={(e) => setWithdrawNote(e.target.value)}
          />
          <button className="btn-primary whitespace-nowrap" disabled={submitting}>
            {submitting ? "Saving..." : "Log Withdrawal"}
          </button>
        </form>
      </div>

      <h2 className="font-semibold mb-3">Reserve fund history</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-400 border-b border-white/10">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Type</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 && (
              <tr>
                <td className="p-3 text-gray-500" colSpan={4}>No movements yet.</td>
              </tr>
            )}
            {ledger.map((row) => (
              <tr key={row.id} className="border-b border-white/5">
                <td className="p-3 text-gray-400">{new Date(row.created_at).toLocaleDateString()}</td>
                <td className="p-3">
                  {row.type === "contribution" ? (
                    <span className="text-accent2">+ Contribution</span>
                  ) : (
                    <span className="text-red-400">- Withdrawal</span>
                  )}
                </td>
                <td className="p-3">${Number(row.amount).toFixed(2)}</td>
                <td className="p-3 text-gray-400">{row.note ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
