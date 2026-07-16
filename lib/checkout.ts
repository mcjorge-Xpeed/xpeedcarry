export async function redirectToCheckout(orderId: string) {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
  const { url } = await res.json();
  if (url) window.location.href = url;
}
