export async function redirectToCheckout(orderId: string) {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
  const { url } = await res.json();
  if (url) window.location.href = url;
}

export async function redirectToTipCheckout(orderId: string, amount: number) {
  const res = await fetch("/api/checkout/tip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, amount }),
  });
  const { url } = await res.json();
  if (url) window.location.href = url;
}
