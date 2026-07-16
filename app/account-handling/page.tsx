export const metadata = { title: "Account Handling Rules | XpeedCarry" };

export default function AccountHandlingPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <h1 className="text-3xl font-bold mb-2">Account Handling Rules</h1>
      <p className="text-gray-400 text-sm mb-8">Applies to Piloted orders, where a pro logs into your account to complete the service.</p>

      <div className="card p-6 space-y-4 text-sm text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">Access is temporary and limited</h2>
          <p>
            Your pro only accesses your account for the time needed to complete your order. Credentials
            are used solely to perform the service you purchased and are discarded once the order is
            complete.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">What your pro will not do</h2>
          <p>
            Your pro will not make purchases, change your password, email, or security settings, or access
            unrelated account areas. Any such action is a violation of our policy and should be reported
            immediately.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">Please avoid logging in during the order</h2>
          <p>
            To keep the service smooth and avoid interruptions, please don't log into your account while
            an order is in progress. You'll be notified through the chat as soon as it's finished.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-2">After delivery</h2>
          <p>
            We recommend changing your password after every Piloted order as a general security habit,
            regardless of who you share access with.
          </p>
        </section>
      </div>
    </div>
  );
}
