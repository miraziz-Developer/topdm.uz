"use client";

import { Truck } from "lucide-react";
import { useMemo, useState } from "react";

import { CheckoutShell } from "@/components/checkout/checkout-shell";
import { DeliveryAddressSection } from "@/components/checkout/delivery-address-section";
import { PaymentMethodPicker, type CheckoutPaymentMethod } from "@/components/checkout/payment-method-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  quoteDeliveryOptions,
  reserveDeliveryOrders,
  type DeliveryQuoteOption,
  type DeliveryQuoteResponse,
} from "@/lib/api";
import { getRefToken } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import { useUserStore } from "@/stores/user-store";
import { normalizeUzbekPhoneE164 } from "@/utils/phone-mask";

function formatPrice(n: number): string {
  return `${n.toLocaleString("uz-UZ")} so'm`;
}

export function DeliveryCheckout() {
  const { push } = useToast();
  const lines = useCartStore((s) => s.lines);
  const clear = useCartStore((s) => s.clear);
  const profile = useUserStore((s) => s.profile);

  const [phone, setPhone] = useState(profile?.phone ?? "+998");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [addressQuery, setAddressQuery] = useState("");
  const [resolvedLabel, setResolvedLabel] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [city, setCity] = useState("Toshkent");
  const [apartment, setApartment] = useState("");
  const [entrance, setEntrance] = useState("");
  const [floor, setFloor] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState<DeliveryQuoteResponse | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<"express" | "cargo">("express");
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const items = useMemo(
    () =>
      lines.map((line) => ({
        product_id: line.product.id,
        quantity: line.quantity,
        color: line.selectedOptions?.color,
        size: line.selectedOptions?.size,
      })),
    [lines],
  );

  const destinationAddress = useMemo(() => {
    const parts = [resolvedLabel || addressQuery.trim(), apartment.trim(), entrance.trim(), floor.trim()]
      .filter(Boolean)
      .join(", ");
    return parts || addressQuery.trim();
  }, [addressQuery, apartment, entrance, floor, resolvedLabel]);

  const selectedOption: DeliveryQuoteOption | null =
    quote?.options.find((o) => o.carrier_class === selectedCarrier) ?? null;

  const fetchQuote = async () => {
    if (!items.length) {
      push("Savatcha bo'sh", "error");
      return;
    }
    if (!destinationAddress.trim()) {
      push("Manzil kiriting", "error");
      return;
    }
    if (lat == null || lng == null) {
      push("Avval manzilni xaritadan yoki qidiruvdan tanlang", "error");
      return;
    }
    setLoadingQuote(true);
    try {
      const data = await quoteDeliveryOptions({
        items,
        user_phone: normalizeUzbekPhoneE164(phone),
        destination_address: destinationAddress,
        destination_lat: lat,
        destination_lng: lng,
        destination_city: city.trim() || "Toshkent",
      });
      setQuote(data);
      setSelectedCarrier(data.recommended_carrier);
    } catch {
      push("Dostavka tarifini olishda xato", "error");
    } finally {
      setLoadingQuote(false);
    }
  };

  const submit = async () => {
    if (!quote || !selectedOption) {
      push("Avval dostavka tarifini hisoblang", "error");
      return;
    }
    if (lat == null || lng == null) {
      push("Yetkazish manzilini tanlang", "error");
      return;
    }
    setSubmitting(true);
    try {
      await reserveDeliveryOrders({
        items,
        user_phone: normalizeUzbekPhoneE164(phone),
        user_email: email.trim() || undefined,
        payment_method: paymentMethod,
        note: note.trim() || undefined,
        ref_token: getRefToken(),
        destination_address: destinationAddress,
        destination_lat: lat,
        destination_lng: lng,
        destination_city: city.trim() || "Toshkent",
        carrier_class: selectedOption.carrier_class,
        delivery_cost_uzs: selectedOption.delivery_cost_uzs,
        delivery_eta_minutes: selectedOption.eta_minutes ?? undefined,
        offer_payload: selectedOption.offer_payload ?? undefined,
      });
      clear();
      push("Delivery buyurtma qabul qilindi", "success");
    } catch {
      push("Buyurtmani yaratib bo'lmadi", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CheckoutShell>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <h1 className="text-xl font-semibold text-ink-900">Delivery checkout</h1>
            <p className="text-sm text-ink-500">BTS Express bilan eshikkacha yetkazish</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998901234567" />
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (ixtiyoriy)" />
            <DeliveryAddressSection
              query={addressQuery}
              onQueryChange={setAddressQuery}
              resolvedLabel={resolvedLabel}
              lat={lat}
              lng={lng}
              onResolved={(hit) => {
                setResolvedLabel(hit.label);
                setLat(hit.lat);
                setLng(hit.lng);
                setAddressQuery(hit.label);
                setQuote(null);
              }}
              onClearResolved={() => {
                setResolvedLabel(null);
                setLat(null);
                setLng(null);
                setQuote(null);
              }}
              apartment={apartment}
              onApartmentChange={setApartment}
              entrance={entrance}
              onEntranceChange={setEntrance}
              floor={floor}
              onFloorChange={setFloor}
              city={city}
              onCityChange={setCity}
            />
            <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Izoh (ixtiyoriy)" />
            <Button
              variant="secondary"
              className="w-full"
              onClick={fetchQuote}
              disabled={loadingQuote || lat == null}
            >
              {loadingQuote ? "Hisoblanmoqda..." : "Dostavka tarifini hisoblash"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-ink-900">To'lov tafsiloti</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {!quote ? (
              <p className="text-sm text-ink-500">Tarif chiqqach express/cargo tanlanadi.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {quote.options.map((opt) => (
                    <button
                      key={opt.carrier_class}
                      type="button"
                      onClick={() => setSelectedCarrier(opt.carrier_class)}
                      className={`w-full rounded-xl border px-3 py-2 text-left ${
                        selectedCarrier === opt.carrier_class ? "border-electric-500 bg-electric-500/5" : "border-ink-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-ink-900">{opt.label}</span>
                        <span className="text-sm text-ink-700">{formatPrice(opt.delivery_cost_uzs)}</span>
                      </div>
                      <p className="text-xs text-ink-500">ETA: ~{opt.eta_minutes ?? 30} min</p>
                    </button>
                  ))}
                </div>

                <div className="rounded-2xl border border-ink-200 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
                    <Truck className="h-4 w-4" /> Split bill
                  </div>
                  <div className="space-y-1 text-sm text-ink-700">
                    <div className="flex justify-between">
                      <span>Product Price</span>
                      <span>{formatPrice(quote.product_subtotal_uzs)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dostavka xizmati (BTS)</span>
                      <span>{formatPrice(selectedOption?.delivery_cost_uzs ?? 0)}</span>
                    </div>
                    <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold text-ink-900">
                      <span>Total Payable</span>
                      <span>{formatPrice(quote.product_subtotal_uzs + (selectedOption?.delivery_cost_uzs ?? 0))}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
            <Button variant="brand" className="w-full" onClick={submit} disabled={!quote || submitting}>
              {submitting ? "Yuborilmoqda..." : "Buyurtmani tasdiqlash"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </CheckoutShell>
  );
}
