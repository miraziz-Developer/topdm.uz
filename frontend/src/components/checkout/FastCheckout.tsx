"use client";

import { Phone, Truck, Zap } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CheckoutShell } from "@/components/checkout/checkout-shell";
import {
  buildFullDeliveryAddress,
  DeliveryAddressSection,
} from "@/components/checkout/delivery-address-section";
import { FulfillmentModePicker, type FulfillmentMode } from "@/components/checkout/fulfillment-mode-picker";
import {
  PaymentMethodPicker,
  type CheckoutPaymentMethod,
} from "@/components/checkout/payment-method-picker";
import { PICKUP_SLOTS, PickupSchedule } from "@/components/checkout/pickup-schedule";
import { PickupStoreLocations } from "@/components/checkout/pickup-store-locations";
import { ReservationSuccessModal } from "@/components/checkout/reservation-success-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  quoteDeliveryOptions,
  reserveDeliveryOrders,
  reservePickupOrders,
  type DeliveryQuoteOption,
  type DeliveryQuoteResponse,
  type PickupReservationResponse,
} from "@/lib/api";
import { playSuccessDing } from "@/lib/audio";
import { cartLineKey } from "@/lib/cart-line";
import { ApiError } from "@/lib/http-client";
import { saveGuestPhone } from "@/lib/guest-phone";
import { productImage } from "@/lib/media";
import { selectionKey, selectionLabel } from "@/lib/product-options";
import { allowOnlineCheckout } from "@/lib/runtime-flags";
import { getRefToken } from "@/lib/utils";
import {
  applyPhoneMaskInput,
  formatUzbekPhoneParenDisplay,
  normalizeUzbekPhoneE164,
  UZ_PHONE_E164_REGEX,
} from "@/utils/phone-mask";
import { useCartStore } from "@/stores/cart-store";
import { useLoyaltyStore } from "@/stores/loyalty-store";
import { useUserStore } from "@/stores/user-store";

const DEFAULT_LAT = 41.3111;
const DEFAULT_LNG = 69.2797;

function formatUzs(n: number): string {
  return `${n.toLocaleString("uz-UZ")} so'm`;
}

export function FastCheckout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { push } = useToast();
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clear = useCartStore((state) => state.clear);
  const totalPrice = useCartStore((state) => state.totalPrice());
  const earn = useLoyaltyStore((state) => state.earn);
  const profile = useUserStore((state) => state.profile);

  const initialMode: FulfillmentMode = searchParams.get("mode") === "delivery" ? "delivery" : "pickup";
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>(initialMode);

  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("12:00");
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("cash");
  const [phone, setPhone] = useState(() =>
    profile?.phone ? formatUzbekPhoneParenDisplay(profile.phone) : "+998 ",
  );
  const [email, setEmail] = useState(profile?.email ?? "");
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [dateError, setDateError] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [reservation, setReservation] = useState<PickupReservationResponse | null>(null);

  const [addressQuery, setAddressQuery] = useState("");
  const [resolvedLabel, setResolvedLabel] = useState<string | null>(null);
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [city, setCity] = useState("Toshkent");
  const [apartment, setApartment] = useState("");
  const [entrance, setEntrance] = useState("");
  const [floor, setFloor] = useState("");
  const [quote, setQuote] = useState<DeliveryQuoteResponse | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<"express" | "cargo">("express");
  const [loadingQuote, setLoadingQuote] = useState(false);

  const cartProducts = useMemo(() => lines.map((line) => line.product), [lines]);
  const items = useMemo(
    () => lines.map((line) => ({ product_id: line.product.id, quantity: line.quantity })),
    [lines],
  );

  useEffect(() => {
    if (profile?.phone) setPhone(formatUzbekPhoneParenDisplay(profile.phone));
    if (profile?.email) setEmail(profile.email);
  }, [profile?.phone, profile?.email]);

  useEffect(() => {
    setQuote(null);
  }, [fulfillmentMode, addressQuery, apartment, entrance, floor, city, lines.length]);

  const pickupLabel = useMemo(
    () => PICKUP_SLOTS.find((slot) => slot.value === pickupTime)?.label ?? pickupTime,
    [pickupTime],
  );

  const selectedOption: DeliveryQuoteOption | null =
    quote?.options.find((o) => o.carrier_class === selectedCarrier) ?? null;

  const deliveryTotal =
    quote && selectedOption ? quote.product_subtotal_uzs + selectedOption.delivery_cost_uzs : null;

  const handlePhoneChange = (value: string) => {
    setPhone(applyPhoneMaskInput(value));
    if (phoneError) setPhoneError(undefined);
  };

  const validatePhone = (): string | null => {
    const phoneE164 = normalizeUzbekPhoneE164(phone);
    if (!UZ_PHONE_E164_REGEX.test(phoneE164)) {
      setPhoneError("To'liq raqam kiriting: +998 (XX) XXX-XX-XX");
      push("Telefon raqamini to'g'ri kiriting", "error");
      return null;
    }
    return phoneE164;
  };

  const mergedNote = () => {
    const optionNotes = lines
      .map((line) => {
        const label = selectionLabel(line.selectedOptions);
        return label ? `${line.product.name}: ${label}` : "";
      })
      .filter(Boolean);
    return [note.trim(), ...optionNotes].filter(Boolean).join(" | ");
  };

  const fetchDeliveryQuote = async (phoneE164: string) => {
    if (deliveryLat == null || deliveryLng == null) {
      push("Avval manzilni xaritadan tanlang", "error");
      return;
    }
    const fullAddress = buildFullDeliveryAddress({
      resolvedLabel,
      query: addressQuery,
      city,
      apartment,
      entrance,
      floor,
    });
    if (!fullAddress.trim()) {
      push("Yetkazish manzilini kiriting", "error");
      return;
    }

    setLoadingQuote(true);
    try {
      const data = await quoteDeliveryOptions({
        items,
        user_phone: phoneE164,
        destination_address: fullAddress,
        destination_lat: deliveryLat,
        destination_lng: deliveryLng,
        destination_city: city.trim() || "Toshkent",
      });
      setQuote(data);
      setSelectedCarrier(data.recommended_carrier);
    } catch {
      push("Yetkazish narxini hisoblab bo'lmadi", "error");
    } finally {
      setLoadingQuote(false);
    }
  };

  const submitPickup = async (phoneE164: string) => {
    if (!pickupDate) {
      setDateError("Sanani tanlang");
      push("Iltimos, olib ketish sanasini tanlang", "error");
      return;
    }
    setDateError(undefined);

    const effectivePayment: CheckoutPaymentMethod =
      allowOnlineCheckout() || paymentMethod === "cash" || paymentMethod === "terminal"
        ? paymentMethod
        : "cash";

    const data = await reservePickupOrders(
      {
        items,
        user_phone: phoneE164,
        user_email: email.trim() || undefined,
        pickup_date: pickupDate,
        pickup_time: pickupTime,
        payment_method: effectivePayment,
        note: mergedNote() || undefined,
        ref_token: getRefToken(),
      },
      { silent: true },
    );

    clear();
    saveGuestPhone(phoneE164);
    earn(lines.length * 12);
    void playSuccessDing();
    setReservation(data);
  };

  const submitDelivery = async (phoneE164: string) => {
    if (!quote || !selectedOption) {
      push("Avval yetkazish narxini hisoblang", "error");
      return;
    }

    const fullAddress = buildFullDeliveryAddress({
      resolvedLabel,
      query: addressQuery,
      city,
      apartment,
      entrance,
      floor,
    });

    const effectivePayment: CheckoutPaymentMethod =
      allowOnlineCheckout() || paymentMethod === "cash" || paymentMethod === "terminal"
        ? paymentMethod
        : "cash";

    await reserveDeliveryOrders({
      items,
      user_phone: phoneE164,
      user_email: email.trim() || undefined,
      payment_method: effectivePayment,
      note: mergedNote() || undefined,
      ref_token: getRefToken(),
      destination_address: fullAddress,
      destination_lat: deliveryLat ?? DEFAULT_LAT,
      destination_lng: deliveryLng ?? DEFAULT_LNG,
      destination_city: city.trim() || "Toshkent",
      carrier_class: selectedOption.carrier_class,
      delivery_cost_uzs: selectedOption.delivery_cost_uzs,
      delivery_eta_minutes: selectedOption.eta_minutes ?? undefined,
      offer_payload: selectedOption.offer_payload ?? undefined,
    });

    clear();
    saveGuestPhone(phoneE164);
    earn(lines.length * 12);
    push("Yetkazish buyurtmasi qabul qilindi", "success");
    router.push(profile ? "/orders" : "/search");
  };

  const submit = async () => {
    if (!lines.length) {
      push("Savatcha bo'sh", "error");
      return;
    }
    const phoneE164 = validatePhone();
    if (!phoneE164) return;

    setLoading(true);
    try {
      if (fulfillmentMode === "pickup") {
        await submitPickup(phoneE164);
      } else {
        await submitDelivery(phoneE164);
      }
    } catch (err) {
      const message =
        err instanceof ApiError && err.message
          ? err.message
          : "Buyurtmani yakunlab bo'lmadi. Qayta urinib ko'ring.";
      push(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const closeSuccess = () => {
    setReservation(null);
    router.push(profile ? "/orders" : "/search");
  };

  if (!lines.length && !reservation) {
    return (
      <CheckoutShell>
        <Card className="border-electric-500/12 bg-white">
          <CardContent className="py-12 text-center">
            <p className="text-ink-500">Savatchangiz bo&apos;sh.</p>
            <Button variant="brand" className="mt-4" onClick={() => router.push("/search")}>
              Tovarlarni ko&apos;rish
            </Button>
          </CardContent>
        </Card>
      </CheckoutShell>
    );
  }

  return (
    <CheckoutShell>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card className="overflow-hidden border-electric-500/12 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <h2 className="text-lg font-semibold text-ink-900">Yetkazish usuli</h2>
              <p className="text-sm text-ink-500">Bittadan tanlang — keyin shu bo‘yicha davom etasiz</p>
            </CardHeader>
            <CardContent>
              <FulfillmentModePicker value={fulfillmentMode} onChange={setFulfillmentMode} />
            </CardContent>
          </Card>

          {fulfillmentMode === "pickup" ? (
            <>
              <Card className="overflow-hidden border-electric-500/12 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <h2 className="text-lg font-semibold text-ink-900">Do&apos;kondan olib ketish</h2>
                  <p className="text-sm text-ink-500">Vaqt oralig&apos;ini tanlang</p>
                </CardHeader>
                <CardContent className="space-y-5 bg-white pt-1">
                  <PickupStoreLocations products={cartProducts} />
                  <PickupSchedule
                    pickupDate={pickupDate}
                    pickupTime={pickupTime}
                    onDateChange={(value) => {
                      setPickupDate(value);
                      if (dateError) setDateError(undefined);
                    }}
                    onTimeChange={setPickupTime}
                    dateError={dateError}
                  />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="overflow-hidden border-orange-200 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <h2 className="text-lg font-semibold text-ink-900">Yetkazib berish manzili</h2>
                <p className="text-sm text-ink-500">Yozilgan manzil va xarita joyi birga yuboriladi</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <DeliveryAddressSection
                  query={addressQuery}
                  onQueryChange={setAddressQuery}
                  resolvedLabel={resolvedLabel}
                  lat={deliveryLat}
                  lng={deliveryLng}
                  onResolved={(hit) => {
                    setResolvedLabel(hit.label);
                    setDeliveryLat(hit.lat);
                    setDeliveryLng(hit.lng);
                    setAddressQuery(hit.label);
                  }}
                  onClearResolved={() => {
                    setResolvedLabel(null);
                    setDeliveryLat(null);
                    setDeliveryLng(null);
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
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={loadingQuote || deliveryLat == null}
                  onClick={() => {
                    const phoneE164 = validatePhone();
                    if (phoneE164) void fetchDeliveryQuote(phoneE164);
                  }}
                >
                  {loadingQuote ? "Hisoblanmoqda..." : "Yetkazish narxini hisoblash"}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-electric-500/12 bg-white">
            <CardHeader>
              <h2 className="text-lg font-semibold text-ink-900">Aloqa</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Telefon"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+998 (90) 123-45-67"
                value={phone}
                onChange={(event) => handlePhoneChange(event.target.value)}
                leftIcon={<Phone className="h-4 w-4 text-electric-500" />}
                error={phoneError}
              />
              <Input
                label="Email (ixtiyoriy)"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="siz@email.com"
              />
              <Input
                label="Izoh"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="O'lcham, rang yoki boshqa talab"
              />
            </CardContent>
          </Card>

          <Card className="border-electric-500/12 bg-white p-5">
            <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
          </Card>
        </div>

        <Card className="h-fit border-electric-500/12 bg-white shadow-md ring-1 ring-electric-500/5">
          <CardHeader>
            <h2 className="text-lg font-semibold text-ink-900">Buyurtma xulosasi</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[min(40vh,320px)] space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain pr-1">
              {lines.map((line) => (
                <div
                  key={cartLineKey(line.product.id, line.mode, selectionKey(line.selectedOptions))}
                  className="flex shrink-0 gap-3"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-electric-500/10 bg-white">
                    <Image
                      src={productImage(line.product.images)}
                      alt={line.product.name}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-ink-900">{line.product.name}</p>
                    {selectionLabel(line.selectedOptions) ? (
                      <p className="mt-1 text-xs text-ink-500">{selectionLabel(line.selectedOptions)}</p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-electric-500/25 px-2 py-0.5 text-sm text-ink-700 hover:bg-electric-500/8"
                        onClick={() => setQuantity(line.product.id, line.quantity - 1, line.mode, line.selectedOptions)}
                        aria-label="Kamaytirish"
                      >
                        −
                      </button>
                      <span className="min-w-[1.5rem] text-center text-sm font-semibold text-electric-500">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        className="rounded-lg border border-electric-500/25 px-2 py-0.5 text-sm text-ink-700 hover:bg-electric-500/8"
                        onClick={() => setQuantity(line.product.id, line.quantity + 1, line.mode, line.selectedOptions)}
                        aria-label="Ko'paytirish"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="ml-auto shrink-0 text-xs text-ink-500 hover:text-electric-500 hover:underline"
                        onClick={() => removeItem(line.product.id, line.mode, line.selectedOptions)}
                      >
                        O&apos;chirish
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {fulfillmentMode === "delivery" && quote ? (
              <div className="space-y-2 rounded-xl border border-orange-200 bg-orange-50/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">Yetkazish tarifi</p>
                {quote.options.map((opt) => (
                  <button
                    key={opt.carrier_class}
                    type="button"
                    onClick={() => setSelectedCarrier(opt.carrier_class)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                      selectedCarrier === opt.carrier_class
                        ? "border-orange-400 bg-white"
                        : "border-orange-200/80 bg-white/70"
                    }`}
                  >
                    <span className="font-medium text-ink-900">{opt.label}</span>
                    <span>{formatUzs(opt.delivery_cost_uzs)}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="space-y-2 border-t border-electric-500/15 pt-4 text-sm">
              <div className="flex justify-between text-ink-500">
                <span>Mahsulotlar</span>
                <span>{formatUzs(quote?.product_subtotal_uzs ?? totalPrice)}</span>
              </div>
              <div className="flex justify-between text-ink-500">
                <span>Yetkazib berish</span>
                <span className="font-medium text-ink-700">
                  {fulfillmentMode === "pickup"
                    ? "Yo'q (do'kondan olib ketish)"
                    : selectedOption
                      ? formatUzs(selectedOption.delivery_cost_uzs)
                      : "Hisoblanmagan"}
                </span>
              </div>
              {fulfillmentMode === "pickup" && pickupDate ? (
                <p className="rounded-lg bg-electric-500/8 px-2 py-1 text-[11px] font-medium text-electric-500">
                  {pickupDate} · {pickupLabel}
                </p>
              ) : null}
              <div className="flex justify-between text-lg font-bold text-ink-900">
                <span>Jami</span>
                <span className="price-mono text-electric-500">
                  {formatUzs(
                    fulfillmentMode === "delivery" && deliveryTotal != null ? deliveryTotal : totalPrice,
                  )}
                </span>
              </div>
            </div>

            <Button
              variant="brand"
              className="w-full uppercase tracking-wider"
              size="lg"
              isLoading={loading}
              disabled={loading || (fulfillmentMode === "delivery" && !quote)}
              onClick={submit}
              leftIcon={!loading ? (fulfillmentMode === "delivery" ? <Truck className="h-4 w-4" /> : <Zap className="h-4 w-4" />) : undefined}
            >
              {fulfillmentMode === "delivery" ? "Yetkazishni tasdiqlash" : "Zaxiraga olishni tasdiqlash"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {reservation ? <ReservationSuccessModal data={reservation} onClose={closeSuccess} /> : null}
    </CheckoutShell>
  );
}
