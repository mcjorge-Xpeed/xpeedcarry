export const metadata = { title: "Refund Policy | XpeedCarry" };

export default function RefundPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <h1 className="text-3xl font-bold mb-2">Refund Policy</h1>
      <p className="text-gray-400 text-sm mb-8">Last updated: this is a starting template — have a lawyer review it before you rely on it for real transactions.</p>

      <div className="card p-6 space-y-4 text-sm text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">Full refund</h2>
          <p>
            You're entitled to a full refund if we cancel your order, or if work has not yet started and
            you cancel within 1 hour of purchase.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">Partial refund</h2>
          <p>
            If a pro has started but not finished the order, we will refund the unfinished portion, based
            on the percentage of the agreed scope actually completed.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">No refund</h2>
          <p>
            Once an order is marked completed and delivered as described, it is not eligible for a refund.
            We also do not refund orders where the account was banned or restricted by the game publisher
            for reasons unrelated to our service (see the account risk disclosure in our{" "}
            <a href="/terms" className="text-accent hover:underline">Terms</a>).
          </p>
          <p>
            If your account is suspended for violating our{" "}
            <a href="/guidelines" className="text-accent hover:underline">Community Guidelines</a> (for
            example, abusive behavior toward a pro or support), any order affected by that suspension is
            not eligible for a refund.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">How to request a refund</h2>
          <p>
            Open a chat from your order page or contact <a href="/support" className="text-accent hover:underline">support</a> within
            7 days of your order. We aim to respond within 24 hours.
          </p>
        </section>
      </div>
    </div>
  );
}
