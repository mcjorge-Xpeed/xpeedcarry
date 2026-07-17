import Link from "next/link";

export default function Footer() {
  return (
    <footer className="text-center px-6 py-10 border-t border-white/[0.08] text-[#a9a9b8] mt-10">
      <p>&copy; {new Date().getFullYear()} XpeedCarry. All rights reserved.</p>
      <div className="flex justify-center gap-4 flex-wrap mt-3 text-sm">
        <Link href="/" className="hover:text-white transition">Home</Link>
        <Link href="/#games" className="hover:text-white transition">Services</Link>
        <Link href="/support" className="hover:text-white transition">Contact</Link>
        <Link href="/terms" className="hover:text-white transition">Terms</Link>
        <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
        <Link href="/refund" className="hover:text-white transition">Refund Policy</Link>
        <Link href="/guidelines" className="hover:text-white transition">Community Guidelines</Link>
      </div>
      <p className="text-xs text-[#6f6f80] max-w-2xl mx-auto mt-4">
        XpeedCarry is an independent service provider and is not endorsed by, directly affiliated with,
        maintained, authorized, or sponsored by any third-party game publisher, developer, or rights holder.
        All trademarks, service marks, and logos are the property of their respective owners.
      </p>
    </footer>
  );
}
