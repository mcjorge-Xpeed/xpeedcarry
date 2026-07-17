"use client";

import { useState } from "react";
import Link from "next/link";

export default function TermsGateModal({
  price,
  onConfirm,
  onClose,
}: {
  price: number;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    await onConfirm();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div className="card p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-2">Before you pay</h3>
        <p className="text-sm text-gray-400 mb-4">
          Please confirm you agree to our policies before we process your ${price.toFixed(2)} payment.
        </p>
        <label className="flex items-start gap-3 text-xs text-gray-300 mb-5">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="accent-[#8b5cf6] mt-0.5"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="text-accent hover:underline">Terms</Link>,{" "}
            <Link href="/privacy" target="_blank" className="text-accent hover:underline">Privacy Policy</Link>,{" "}
            <Link href="/refund" target="_blank" className="text-accent hover:underline">Refund Policy</Link>,{" "}
            <Link href="/account-handling" target="_blank" className="text-accent hover:underline">Account Handling Rules</Link>, and{" "}
            <Link href="/guidelines" target="_blank" className="text-accent hover:underline">Community Guidelines</Link>.
          </span>
        </label>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="btn-primary flex-1" onClick={handleConfirm} disabled={!agreed || loading}>
            {loading ? "Redirecting..." : "Confirm & Pay"}
          </button>
        </div>
      </div>
    </div>
  );
}
