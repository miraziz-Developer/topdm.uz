import { redirect } from "next/navigation";

export default function DeliveryCheckoutRedirectPage() {
  redirect("/checkout?mode=delivery");
}
