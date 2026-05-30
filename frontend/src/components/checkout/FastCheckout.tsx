"use client";

import { Phone, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CheckoutShell } from "@/components/checkout/checkout-shell";
import {
  PaymentMethodPicker,
  type CheckoutPaymentMethod,
} from "@/components/checkout/payment-method-picker";
import { PICKUP_SLOTS, PickupSchedule } from "@/components/checkout/pickup-schedule";
import { ReservationSuccessModal } from "@/components/checkout/reservation-success-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { type PickupReservationResponse, reservePickupOrders } from "@/lib/api";
import { playSuccessDing } from "@/lib/audio";
import { cartLineKey } from "@/lib/cart-line";
import { selectionKey, selectionLabel } from "@/lib/product-options";
import { ApiError } from "@/lib/http-client";
import { saveGuestPhone } from "@/lib/guest-phone";
import { allowOnlineCheckout } from "@/lib/runtime-flags";
import { productImage } from "@/lib/media";
import {
  applyPhoneMaskInput,
  formatUzbekPhoneParenDisplay,
  normalizeUzbekPhoneE164,
  UZ_PHONE_E164_REGEX,
} from "@/utils/phone-mask";
import { getRefToken } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import { useLoyaltyStore } from "@/stores/loyalty-store";
import { useUserStore } from "@/stores/user-store";

export function FastCheckout() {
  const router = useRouter();
  const { push } = useToast();
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clear = useCartStore((state) => state.clear);
  const totalPrice = useCartStore((state) => state.totalPrice());
  const earn = useLoyaltyStore((state) => state.earn);
  const profile = useUserStore((state) => state.profile);

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

  useEffect(() => {
    if (profile?.phone) {
      setPhone(formatUzbekPhoneParenDisplay(profile.phone));
    }
    if (profile?.email) {
      setEmail(profile.email);
    }
  }, [profile?.phone, profile?.email]);

  const pickupLabel = useMemo(
    () => PICKUP_SLOTS.find((slot) => slot.value === pickupTime)?.label ?? pickupTime,
    [pickupTime],
  );

  const handlePhoneChange = (value: string) => {
    setPhone(applyPhoneMaskInput(value));
    if (phoneError) setPhoneError(undefined);
  };

  const submit = async () => {
    if (!lines.length) {
      push("Savatcha bo'sh", "error");
      return;
    }
    if (!pickupDate) {
      setDateError("Sanani tanlang");
      push("Iltimos, olib ketish sanasini tanlang", "error");
      return;
    }
    setDateError(undefined);

    const phoneE164 = normalizeUzbekPhoneE164(phone);
    if (!UZ_PHONE_E164_REGEX.test(phoneE164)) {
      setPhoneError("To'liq raqam kiriting: +998 (XX) XXX-XX-XX");
      push("Telefon raqamini to'g'ri kiriting", "error");
      return;
    }

    const effectivePayment: CheckoutPaymentMethod =
      allowOnlineCheckout() || paymentMethod === "cash" || paymentMethod === "terminal"
        ? paymentMethod
        : "cash";

    setLoading(true);
    try {
      const optionNotes = lines
        .map((line) => {
          const label = selectionLabel(line.selectedOptions);
          return label ? `${line.product.name}: ${label}` : "";
        })
        .filter(Boolean);
      const mergedNote = [note.trim(), ...optionNotes].filter(Boolean).join(" | ");
      const data = await reservePickupOrders(
        {
          items: lines.map((line) => ({
            product_id: line.product.id,
            quantity: line.quantity,
          })),
          user_phone: phoneE164,
          user_email: email.trim() || undefined,
          pickup_date: pickupDate,
          pickup_time: pickupTime,
          payment_method: effectivePayment,
          note: mergedNote || undefined,
          ref_token: getRefToken(),
        },
        { silent: true },
      );

      clear();
      saveGuestPhone(phoneE164);
      earn(lines.length * 12);
      void playSuccessDing();
      setReservation(data);
    } catch (err) {
      const message =
        err instanceof ApiError && err.message
          ? err.message
          : "Bronni yakunlab bo'lmadi. Qayta urinib ko'ring.";
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
              <h2 className="text-lg font-semibold text-ink-900">Tezkor zaxira qilish (Olib ketish)</h2>
              <p className="text-sm text-ink-500">Zaxira ombordan ajratiladi — yetkazish yo&apos;q</p>
              <p className="pt-1 text-xs text-ink-500">
                Yetkazish kerakmi?{" "}
                <Link href="/checkout/delivery" className="font-semibold text-electric-500 hover:underline">
                  Delivery checkout
                </Link>
              </p>
            </CardHeader>
            <CardContent className="bg-white pt-1">
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
            <h2 className="text-lg font-semibold text-ink-900">Tezkor zaxira qilish (Olib ketish)</h2>
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

            <div className="space-y-2 border-t border-electric-500/15 pt-4 text-sm">
              <div className="flex justify-between text-ink-500">
                <span>Mahsulotlar</span>
                <span>{totalPrice.toLocaleString("uz-UZ")} so&apos;m</span>
              </div>
              <div className="flex justify-between text-ink-500">
                <span>Yetkazib berish</span>
                <span className="font-medium text-ink-700">Yo&apos;q (Do&apos;kondan olib ketish)</span>
              </div>
              {pickupDate ? (
                <p className="rounded-lg bg-electric-500/8 px-2 py-1 text-[11px] font-medium text-electric-500">
                  {pickupDate} · {pickupLabel}
                </p>
              ) : null}
              <div className="flex justify-between text-lg font-bold text-ink-900">
                <span>Jami (do&apos;konda)</span>
                <span className="price-mono text-electric-500">{totalPrice.toLocaleString("uz-UZ")} so&apos;m</span>
              </div>
            </div>

            <Button
              variant="brand"
              className="w-full uppercase tracking-wider"
              size="lg"
              isLoading={loading}
              disabled={loading}
              onClick={submit}
              leftIcon={!loading ? <Zap className="h-4 w-4" /> : undefined}
            >
              Zaxiraga olishni tasdiqlash
            </Button>
          </CardContent>
        </Card>
      </div>

      {reservation ? <ReservationSuccessModal data={reservation} onClose={closeSuccess} /> : null}
    </CheckoutShell>
  );
}
