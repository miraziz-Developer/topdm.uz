"use client";

import { LogIn, Phone, Truck, Zap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CheckoutShell } from "@/components/checkout/checkout-shell";
import { CheckoutStepper } from "@/components/checkout/checkout-stepper";
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
  sendOrderLookupOtp,
  verifyOrderLookupOtp,
  type DeliveryQuoteOption,
  type DeliveryQuoteResponse,
  type PickupReservationResponse,
} from "@/lib/api";
import { playSuccessDing } from "@/lib/audio";
import { cartLineImages } from "@/lib/cart-images";
import { cartLineKey } from "@/lib/cart-line";
import { ApiError } from "@/lib/http-client";
import { saveGuestPhone } from "@/lib/guest-phone";
import { ProductImage } from "@/components/ui/product-image";
import { PremiumPageHero } from "@/components/ui/premium-page-hero";
import { MARKET } from "@/components/brand/premium-market-ui";
import { selectionKey, selectionLabel } from "@/lib/product-options";
import { allowOnlineCheckout } from "@/lib/runtime-flags";
import { getRefToken, cn } from "@/lib/utils";
import {
  applyPhoneMaskInput,
  formatUzbekPhoneParenDisplay,
  normalizeUzbekPhoneE164,
  UZ_PHONE_E164_REGEX,
} from "@/utils/phone-mask";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { useUserStore } from "@/stores/user-store";
import {
  COIN_UZS_RATE,
  coinsForPurchaseAmount,
  maxRedeemableCoins,
} from "@/lib/loyalty";

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
  const refreshProfile = useUserStore((state) => state.refresh);
  const profile = useUserStore((state) => state.profile);
  const authHydrated = useAuthStore((state) => state.hydrated);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const checkoutReturnPath = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `/checkout?${qs}` : "/checkout";
  }, [searchParams]);
  const loginHref = `/auth?next=${encodeURIComponent(checkoutReturnPath)}`;

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

  // Mehmon (login'siz) buyurtma — telefon OTP tasdiq
  const [guestOtpSent, setGuestOtpSent] = useState(false);
  const [guestOtp, setGuestOtp] = useState("");
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [guestVerifiedPhone, setGuestVerifiedPhone] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);

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
  const [coinsToRedeem, setCoinsToRedeem] = useState(0);
  const [useCoins, setUseCoins] = useState(false);

  const cartProducts = useMemo(() => lines.map((line) => line.product), [lines]);
  const uniqueShopIds = useMemo(
    () => new Set(lines.map((line) => line.product.shop?.id).filter(Boolean)),
    [lines],
  );
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

  const coinBalance = profile?.coins_balance ?? 0;
  const checkoutSubtotal =
    fulfillmentMode === "delivery" && quote ? quote.product_subtotal_uzs : totalPrice;

  const maxCoins = useMemo(() => {
    if (!isLoggedIn || fulfillmentMode !== "pickup") return 0;
    return maxRedeemableCoins(coinBalance, checkoutSubtotal);
  }, [isLoggedIn, fulfillmentMode, coinBalance, checkoutSubtotal]);

  const appliedCoins = useCoins && fulfillmentMode === "pickup" ? Math.min(coinsToRedeem, maxCoins) : 0;
  const coinDiscountUzs = appliedCoins * COIN_UZS_RATE;
  const pickupPayable = Math.max(0, totalPrice - coinDiscountUzs);
  const expectedEarnCoins =
    isLoggedIn && fulfillmentMode === "pickup"
      ? coinsForPurchaseAmount(Math.max(0, checkoutSubtotal - coinDiscountUzs))
      : 0;

  useEffect(() => {
    if (!useCoins || maxCoins < 1) {
      setCoinsToRedeem(0);
      return;
    }
    setCoinsToRedeem((prev) => (prev < 1 || prev > maxCoins ? maxCoins : prev));
  }, [maxCoins, useCoins]);

  const handlePhoneChange = (value: string) => {
    setPhone(applyPhoneMaskInput(value));
    if (phoneError) setPhoneError(undefined);
    // Telefon o'zgarsa — oldingi OTP tasdig'ini bekor qilamiz
    if (guestToken || guestOtpSent) {
      setGuestToken(null);
      setGuestVerifiedPhone(null);
      setGuestOtpSent(false);
      setGuestOtp("");
    }
  };

  const guestVerified =
    !!guestToken &&
    !!guestVerifiedPhone &&
    guestVerifiedPhone === normalizeUzbekPhoneE164(phone);

  const sendGuestOtp = async () => {
    const phoneE164 = validatePhone();
    if (!phoneE164) return;
    setOtpLoading(true);
    try {
      const res = await sendOrderLookupOtp(phoneE164);
      setGuestOtpSent(true);
      if (res.dev_otp) {
        push(`Test rejimi: kod ${res.dev_otp}`, "info");
      } else {
        push("Tasdiqlash kodi SMS orqali yuborildi", "success");
      }
    } catch (err) {
      const message = err instanceof ApiError && err.message ? err.message : "Kod yuborilmadi. Qayta urinib ko'ring.";
      push(message, "error");
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyGuestOtp = async () => {
    const phoneE164 = normalizeUzbekPhoneE164(phone);
    if (!UZ_PHONE_E164_REGEX.test(phoneE164)) {
      setPhoneError("To'liq raqam kiriting: +998 (XX) XXX-XX-XX");
      return;
    }
    if (guestOtp.trim().length < 4) {
      push("Kodni to'liq kiriting", "error");
      return;
    }
    setOtpLoading(true);
    try {
      const res = await verifyOrderLookupOtp(phoneE164, guestOtp.trim());
      setGuestToken(res.verification_token);
      setGuestVerifiedPhone(phoneE164);
      push("Telefon tasdiqlandi", "success");
    } catch (err) {
      const message = err instanceof ApiError && err.message ? err.message : "Kod noto'g'ri yoki muddati o'tgan.";
      push(message, "error");
    } finally {
      setOtpLoading(false);
    }
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
    } catch (err) {
      const detail =
        err && typeof err === "object" && "message" in err && typeof err.message === "string"
          ? err.message
          : "";
      push(detail && detail !== "internal_server_error" ? detail : "Yetkazish narxini hisoblab bo'lmadi", "error");
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

    const data = await reservePickupOrders({
      items,
      user_phone: phoneE164,
      user_email: email.trim() || undefined,
      pickup_date: pickupDate,
      pickup_time: pickupTime,
      payment_method: effectivePayment,
      note: mergedNote() || undefined,
      ref_token: getRefToken(),
      verification_token: isLoggedIn ? undefined : guestToken ?? undefined,
      coins_to_redeem: isLoggedIn && appliedCoins > 0 ? appliedCoins : undefined,
    });

    saveGuestPhone(phoneE164);
    if (isLoggedIn) void refreshProfile();
    void playSuccessDing();

    if (effectivePayment === "click" && data.online_checkout_url) {
      clear();
      router.push(data.online_checkout_url);
      return;
    }

    clear();
    setReservation(data);
  };

  const submitDelivery = async (phoneE164: string) => {
    if (uniqueShopIds.size > 1) {
      push("Yetkazish uchun savatchada faqat bitta do'kon mahsuloti bo'lishi kerak", "error");
      return;
    }
    if (deliveryLat == null || deliveryLng == null) {
      push("Yetkazish manzilini xaritadan yoki qidiruvdan tanlang", "error");
      return;
    }
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

    const data = await reserveDeliveryOrders({
      items,
      user_phone: phoneE164,
      user_email: email.trim() || undefined,
      payment_method: effectivePayment,
      note: mergedNote() || undefined,
      ref_token: getRefToken(),
      destination_address: fullAddress,
      destination_lat: deliveryLat,
      destination_lng: deliveryLng,
      destination_city: city.trim() || "Toshkent",
      carrier_class: selectedOption.carrier_class,
      delivery_cost_uzs: selectedOption.delivery_cost_uzs,
      delivery_eta_minutes: selectedOption.eta_minutes ?? undefined,
      offer_payload: selectedOption.offer_payload ?? undefined,
      verification_token: isLoggedIn ? undefined : guestToken ?? undefined,
    });

    saveGuestPhone(phoneE164);
    void playSuccessDing();
    if (data.online_checkout_url) {
      clear();
      router.push(data.online_checkout_url);
      return;
    }
    push("Yetkazish buyurtmasi qabul qilindi", "success");
    router.push("/orders");
  };

  const submit = async () => {
    if (!lines.length) {
      push("Savatcha bo'sh", "error");
      return;
    }
    const phoneE164 = validatePhone();
    if (!phoneE164) return;

    // Mehmon bo'lsa — telefon OTP bilan tasdiqlangan bo'lishi shart
    if (!isLoggedIn && !guestVerified) {
      push("Davom etish uchun telefon raqamingizni tasdiqlang", "error");
      if (!guestOtpSent) void sendGuestOtp();
      return;
    }

    setLoading(true);
    try {
      if (fulfillmentMode === "pickup") {
        await submitPickup(phoneE164);
      } else {
        await submitDelivery(phoneE164);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        push("Avval tizimga kiring", "error");
        router.push(loginHref);
        return;
      }
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
    router.push("/orders");
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
      <CheckoutStepper activeStep="details" />
      <PremiumPageHero
        eyebrow="Bron va to'lov"
        title={
          <>
            Buyurtmani <span className="text-gradient-electric">rasmiylashtirish</span>
          </>
        }
        description="Bir necha qadam — tez, xavfsiz, do'konda olib ketasiz"
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          {authHydrated && !isLoggedIn ? (
            <Card className="ring-glow-electric border-electric-500/20 bg-electric-500/[0.05]">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-900">Mehmon sifatida buyurtma berish</p>
                  <p className="mt-1 text-xs text-ink-600">
                    Ro&apos;yxatdan o&apos;tmasdan ham bo&apos;ladi — pastdan telefon raqamingizni SMS kod bilan tasdiqlang.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  leftIcon={<LogIn className="h-4 w-4" />}
                  onClick={() => router.push(loginHref)}
                >
                  Hisobga kirish
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <h2 className="text-lg font-bold tracking-tight text-ink-900">Yetkazish usuli</h2>
              <p className="text-sm text-ink-500">Bittadan tanlang — keyin shu bo‘yicha davom etasiz</p>
            </CardHeader>
            <CardContent>
              <FulfillmentModePicker value={fulfillmentMode} onChange={setFulfillmentMode} />
            </CardContent>
          </Card>

          {fulfillmentMode === "pickup" ? (
            <>
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <h2 className="text-lg font-bold tracking-tight text-ink-900">Do&apos;kondan olib ketish</h2>
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
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <h2 className="text-lg font-bold tracking-tight text-ink-900">Yetkazib berish manzili</h2>
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

          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold tracking-tight text-ink-900">Aloqa</h2>
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
              {authHydrated && !isLoggedIn ? (
                guestVerified ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm font-medium text-emerald-700">
                    <Phone className="h-4 w-4" />
                    Telefon tasdiqlandi
                  </div>
                ) : (
                  <div className="space-y-3 rounded-xl border border-electric-500/15 bg-electric-500/[0.03] p-3">
                    {!guestOtpSent ? (
                      <>
                        <p className="text-xs text-ink-600">
                          Buyurtmani tasdiqlash uchun raqamingizga SMS kod yuboramiz.
                        </p>
                        <Button
                          variant="secondary"
                          className="w-full"
                          isLoading={otpLoading}
                          disabled={otpLoading}
                          onClick={sendGuestOtp}
                        >
                          SMS kod yuborish
                        </Button>
                      </>
                    ) : (
                      <>
                        <Input
                          label="SMS kod"
                          inputMode="numeric"
                          placeholder="123456"
                          value={guestOtp}
                          onChange={(event) => setGuestOtp(event.target.value.replace(/\D/g, "").slice(0, 8))}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="brand"
                            className="flex-1"
                            isLoading={otpLoading}
                            disabled={otpLoading}
                            onClick={verifyGuestOtp}
                          >
                            Tasdiqlash
                          </Button>
                          <Button
                            variant="ghost"
                            className="shrink-0"
                            disabled={otpLoading}
                            onClick={sendGuestOtp}
                          >
                            Qayta yuborish
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )
              ) : null}
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

          <Card className="p-5">
            <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
          </Card>
        </div>

        <Card className={cn("sticky top-24 h-fit", MARKET.summaryCard)}>
          <CardHeader>
            <h2 className="text-lg font-bold tracking-tight text-ink-900">Buyurtma xulosasi</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[min(40vh,320px)] space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain pr-1">
              {lines.map((line) => (
                <div
                  key={cartLineKey(line.product.id, line.mode, selectionKey(line.selectedOptions))}
                  className="flex shrink-0 gap-3"
                >
                  <ProductImage
                    images={cartLineImages(line.product, line.selectedOptions)}
                    alt={line.product.name}
                    fill
                    wrapperClassName="h-16 w-16 shrink-0 rounded-xl border border-electric-500/10 bg-white"
                    className="object-cover"
                    sizes="64px"
                  />
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

              {fulfillmentMode === "pickup" && isLoggedIn && maxCoins > 0 ? (
                <div className="space-y-2 rounded-xl border border-electric-500/20 bg-electric-500/5 p-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-ink-900">
                      Bozor Coin ({coinBalance} mavjud)
                    </span>
                    <input
                      type="checkbox"
                      checked={useCoins}
                      onChange={(e) => setUseCoins(e.target.checked)}
                      className="h-4 w-4 rounded border-border-default text-electric-500"
                    />
                  </label>
                  {useCoins ? (
                    <div className="space-y-2">
                      <input
                        type="range"
                        min={0}
                        max={maxCoins}
                        value={appliedCoins}
                        onChange={(e) => setCoinsToRedeem(Number(e.target.value))}
                        className="w-full accent-electric-500"
                      />
                      <p className="text-xs text-ink-600">
                        {appliedCoins} Coin · -{formatUzs(coinDiscountUzs)} chegirma
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {fulfillmentMode === "pickup" && isLoggedIn ? (
                <p className="text-[11px] text-ink-500">
                  Buyurtma yakunlangach taxminan +{expectedEarnCoins} Coin yig&apos;iladi.
                </p>
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
              {fulfillmentMode === "pickup" && appliedCoins > 0 ? (
                <div className="flex justify-between text-ink-500">
                  <span>Coin chegirmasi</span>
                  <span className="font-medium text-neon-600">-{formatUzs(coinDiscountUzs)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-lg font-bold text-ink-900">
                <span>Jami</span>
                <span className={cn(MARKET.priceDeal, "text-lg")}>
                  {formatUzs(
                    fulfillmentMode === "delivery" && deliveryTotal != null
                      ? deliveryTotal
                      : pickupPayable,
                  )}
                </span>
              </div>
            </div>

            <Button
              variant="accent"
              className={cn("w-full uppercase tracking-wider", MARKET.cta)}
              size="lg"
              isLoading={loading}
              disabled={loading || (fulfillmentMode === "delivery" && !quote)}
              onClick={submit}
              leftIcon={
                !loading ? (fulfillmentMode === "delivery" ? <Truck className="h-4 w-4" /> : <Zap className="h-4 w-4" />) : undefined
              }
            >
              {fulfillmentMode === "delivery" ? "Yetkazishni tasdiqlash" : "Zaxiraga olishni tasdiqlash"}
            </Button>
            {authHydrated && !isLoggedIn && !guestVerified ? (
              <p className="mt-2 text-center text-[11px] text-ink-500">
                Tasdiqlash uchun avval telefon raqamingizni SMS kod bilan tasdiqlang.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {reservation ? <ReservationSuccessModal data={reservation} onClose={closeSuccess} /> : null}
    </CheckoutShell>
  );
}
