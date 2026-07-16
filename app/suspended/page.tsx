export const metadata = { title: "Account Suspended | XpeedCarry" };

export default function SuspendedPage() {
  return (
    <div className="max-w-md mx-auto mt-24 card p-8 text-center">
      <h1 className="text-xl font-bold mb-3 text-red-400">Account Suspended</h1>
      <p className="text-sm text-gray-300">
        Your account has been suspended for violating our community guidelines. If you think this is a
        mistake, reach out to us at{" "}
        <a href="mailto:support@xpeedcarry.net" className="text-accent hover:underline">
          support@xpeedcarry.net
        </a>
        .
      </p>
    </div>
  );
}
