export type CheckoutPaymentParams = {
  checkoutId: string;
  orderId: string;
  amount: number;
  labelId: string;
};

export function parseCheckoutPaymentParams(
  params: Pick<URLSearchParams, "get">,
): CheckoutPaymentParams | null {
  const checkoutId = params.get("checkout_id") ?? "";
  const orderId = params.get("order_id") ?? "";
  const amount = Number.parseInt(params.get("amount") ?? "0", 10);
  const labelId = checkoutId || orderId;

  if (!labelId || !Number.isFinite(amount) || amount < 1000) {
    return null;
  }

  return { checkoutId, orderId, amount, labelId };
}
