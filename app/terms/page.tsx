export const metadata = { title: "Terms of Service | XpeedCarry" };

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-14 prose-invert">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-gray-400 text-sm mb-8">Last updated: this is a starting template — have a lawyer review it before you rely on it for real transactions.</p>

      <div className="card p-6 mb-6 space-y-4 text-sm text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">1. What we do</h2>
          <p>
            XpeedCarry ("we", "us") connects customers with independent gaming professionals ("pros")
            who provide leveling, progression and carry services in third-party video games. We are an
            independent service provider and are not affiliated with, endorsed by, or sponsored by any
            game publisher, developer, or platform holder.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">2. Eligibility</h2>
          <p>
            You must be old enough to enter a binding contract in your country and legally own the game
            account or platform account used for the order. You are responsible for confirming the
            service does not violate any agreement you have with a third party you are bound by.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">3. Orders and payment</h2>
          <p>
            Orders are paid in full at checkout via Stripe before work begins. Prices shown at checkout
            (base service + selected options) are the final price for that configuration. We reserve the
            right to decline or cancel an order before work begins, in which case you will be refunded in full.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">4. Game account risk</h2>
          <p>
            Many games' own terms of service restrict or prohibit boosting, account sharing, or third-party
            assistance. Using our services carries an inherent risk of action by the game publisher against
            your account (including suspension or ban), which is outside our control. By placing an order
            you acknowledge and accept this risk.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">5. No outcome guarantee beyond the scope ordered</h2>
          <p>
            We guarantee delivery of the specific service scope you selected at checkout (e.g. the levels,
            missions, or milestones described). We do not guarantee any in-game outcome, ranking, or reward
            beyond what was explicitly described in your order.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">6. Refunds and cancellations</h2>
          <p>
            See our <a href="/refund" className="text-accent hover:underline">Refund Policy</a> for full details.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">7. Account handling (Piloted orders)</h2>
          <p>
            If you choose a Piloted order, see our{" "}
            <a href="/account-handling" className="text-accent hover:underline">Account Handling Rules</a> for
            how your credentials and account access are treated.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">8. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, XpeedCarry's liability for any claim arising from an
            order is limited to the amount paid for that order. We are not liable for indirect, incidental,
            or consequential damages, including loss of account access or in-game progress caused by a
            third party (including the game publisher).
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">9. Contact</h2>
          <p>Questions about these terms? Reach us through our <a href="/support" className="text-accent hover:underline">support chat</a>.</p>
        </section>
      </div>
    </div>
  );
}
