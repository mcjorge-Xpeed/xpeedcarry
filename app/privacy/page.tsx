export const metadata = { title: "Privacy Policy | XpeedCarry" };

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-gray-400 text-sm mb-8">Last updated: this is a starting template — have a lawyer review it before you rely on it for real transactions.</p>

      <div className="card p-6 space-y-4 text-sm text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">1. What we collect</h2>
          <p>
            We collect your email address (for sign-in and order updates), order details you provide
            (game, service options, description), and messages you send through our chat. For Piloted
            orders, we may temporarily receive game account credentials solely to perform the order.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">2. Payment data</h2>
          <p>
            Payments are processed by Stripe. We never see or store your full card number — Stripe
            handles that directly and securely.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">3. Who we share data with</h2>
          <p>
            We use Supabase (database and authentication), Stripe (payments) and Resend (transactional
            email) as service providers to operate XpeedCarry. We do not sell your data to third parties.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">4. How long we keep data</h2>
          <p>
            We keep order and account data for as long as your account is active, or as needed to comply
            with legal, tax, or dispute-resolution obligations.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">5. Your rights</h2>
          <p>
            You can request a copy of your data or ask us to delete your account by contacting{" "}
            <a href="/support" className="text-accent hover:underline">support</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
