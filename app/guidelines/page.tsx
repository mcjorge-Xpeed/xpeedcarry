export const metadata = { title: "Community Guidelines | XpeedCarry" };

export default function GuidelinesPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <h1 className="text-3xl font-bold mb-2">Community Guidelines</h1>
      <p className="text-gray-400 text-sm mb-8">
        These apply to everyone using XpeedCarry — clients and pros alike, in every chat and every order.
      </p>

      <div className="card p-6 space-y-4 text-sm text-gray-300 leading-relaxed mb-6">
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">Respect, always</h2>
          <p>
            Harassment, threats, hate speech, discrimination, or abusive language toward support, a pro,
            or a client will not be tolerated — in chat, in an order, or anywhere else on the platform.
            This applies no matter how frustrated you are with an order; if something's wrong, tell support
            and we'll sort it out.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">Violations get you blocked</h2>
          <p>
            If you break this rule, your account will be suspended — you'll lose access to the entire
            site, including any orders in progress, until an admin reviews the situation and decides
            whether (and when) to reactivate you. Repeat or severe violations may be permanent.
          </p>
        </section>
      </div>

      <div className="card p-6 space-y-4 text-sm text-gray-300 leading-relaxed mb-6">
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">For clients</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Be respectful and clear about what you need — accurate info makes for a smoother order.</li>
            <li>Respond to your pro and support in a reasonably timely way.</li>
            <li>Review delivered work and confirm or dispute it promptly, instead of leaving it hanging.</li>
            <li>Don't demand work outside what was agreed and paid for — extra asks go through support.</li>
          </ul>
        </section>
      </div>

      <div className="card p-6 space-y-4 text-sm text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">For pros</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Be respectful and professional with every client, every time.</li>
            <li>Give your best effort — the goal is a client who's genuinely happy with the result.</li>
            <li>Only do what's in the order's agreed scope; escalate extra requests to support instead of negotiating directly or working for free.</li>
            <li>Never solicit off-platform payment or contact.</li>
            <li>Keep any account access from a Piloted order strictly confidential — see the <a href="/account-handling" className="text-accent hover:underline">Account Handling Rules</a>.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
