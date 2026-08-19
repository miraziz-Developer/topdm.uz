import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maxfiylik siyosati — Bozorliii",
  description: "Bozorliii ilovasi va veb-saytida foydalanuvchi ma'lumotlari qanday to'planishi, ishlatilishi va himoyalanishi haqida.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-ink-800">
      <Link href="/" className="text-sm font-semibold text-electric-500">
        ← Bosh sahifaga qaytish
      </Link>

      <h1 className="mt-6 text-2xl font-black text-ink-900 sm:text-3xl">Maxfiylik siyosati</h1>
      <p className="mt-2 text-sm text-ink-500">Oxirgi yangilanish: 2026-yil 19-avgust</p>

      <div className="mt-8 max-w-none space-y-6 text-sm leading-relaxed sm:text-base">
        <p>
          Ushbu maxfiylik siyosati Bozorliii (<strong>bozorliii.online</strong>, shu jumladan mobil ilova)
          xizmatidan foydalanganingizda qanday ma&apos;lumot to&apos;planishi, saqlanishi va ishlatilishini
          tushuntiradi. Xizmatdan foydalanish orqali siz ushbu siyosat bilan tanishganingizni bildirasiz.
        </p>

        <section>
          <h2 className="text-lg font-bold text-ink-900">1. Qanday ma&apos;lumot to&apos;planadi</h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li><strong>Telefon raqami</strong> — ro&apos;yxatdan o&apos;tish va SMS kod orqali tasdiqlash uchun.</li>
            <li><strong>Buyurtma ma&apos;lumotlari</strong> — bron/xarid tarixi, yetkazib berish manzili (kiritilgan holda).</li>
            <li>
              <strong>Rasmlar</strong> — AI qidiruv va shaxsiy stylist funksiyasi uchun yuklagan fotosuratlaringiz.
              Bu rasmlar faqat mos mahsulot topish uchun tahlil qilinadi.
            </li>
            <li><strong>Joylashuv</strong> — yaqin do&apos;konlarni va xarita navigatsiyasini ko&apos;rsatish uchun (ruxsat bergan holda).</li>
            <li><strong>Qurilma va foydalanish ma&apos;lumotlari</strong> — ilovani yaxshilash uchun anonim analitika (sahifa ko&apos;rishlar, xatoliklar).</li>
            <li><strong>Push-bildirishnoma tokeni</strong> — buyurtma holati haqida xabar yuborish uchun (ruxsat bergan holda).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink-900">2. Ma&apos;lumotlardan qanday foydalaniladi</h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Buyurtma va bronni rasmiylashtirish, do&apos;kon bilan bog&apos;lash;</li>
            <li>AI qidiruv, shaxsiy stylist va tavsiya funksiyalarini ishga tushirish;</li>
            <li>Xizmat sifatini yaxshilash va xatoliklarni aniqlash;</li>
            <li>Muhim xabarnomalar (buyurtma holati, xavfsizlik) yuborish.</li>
          </ul>
          <p className="mt-2">Ma&apos;lumotlaringiz reklama uchun uchinchi shaxslarga sotilmaydi.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink-900">3. Ma&apos;lumotlar kim bilan bo&apos;lishiladi</h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Buyurtma bergan <strong>do&apos;kon egasi</strong> bilan — faqat buyurtmangizni bajarish uchun zarur ma&apos;lumot (ism, telefon, buyurtma tarkibi);</li>
            <li>
              <strong>To&apos;lov va yetkazib berish hamkorlari</strong> (masalan, Click, BTS Express) — ushbu xizmatlar
              faollashtirilgan taqdirda, faqat tranzaksiya uchun zarur ma&apos;lumot doirasida;
            </li>
            <li>Xizmatni ishlatish tahlili uchun analitika provayderlari (masalan, Yandex Metrika, Meta Pixel) — anonimlashtirilgan holatda.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink-900">4. Ma&apos;lumotlar xavfsizligi</h2>
          <p>
            Ma&apos;lumotlaringiz shifrlangan ulanish (HTTPS) orqali uzatiladi va himoyalangan serverlarda saqlanadi.
            Faqat xizmatni ishga tushirish uchun zarur xodimlar ma&apos;lumotlarga kirish huquqiga ega.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink-900">5. Sizning huquqlaringiz</h2>
          <p>Siz istalgan vaqtda quyidagilarni so&apos;rashingiz mumkin:</p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Sizga tegishli ma&apos;lumotlar nusxasini olish;</li>
            <li>Noto&apos;g&apos;ri ma&apos;lumotni tuzatish;</li>
            <li>Hisobingizni va unga bog&apos;liq ma&apos;lumotlarni o&apos;chirishni so&apos;rash.</li>
          </ul>
          <p className="mt-2">Buning uchun quyidagi aloqa kanallari orqali murojaat qiling.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink-900">6. Bolalar maxfiyligi</h2>
          <p>
            Bozorliii 16 yoshgacha bo&apos;lgan foydalanuvchilar uchun mo&apos;ljallanmagan va ulardan ongli ravishda
            ma&apos;lumot to&apos;plamaydi.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink-900">7. Ushbu siyosatga o&apos;zgartirishlar</h2>
          <p>
            Xizmat rivojlanishi bilan ushbu sahifa yangilanishi mumkin. Muhim o&apos;zgarishlar haqida ilova ichida
            xabar beramiz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink-900">8. Bog&apos;lanish</h2>
          <p>
            Savol yoki so&apos;rovlar uchun: Telegram{" "}
            <a href="https://t.me/bozorliii_support" className="font-semibold text-electric-500">
              @bozorliii_support
            </a>{" "}
            yoki{" "}
            <a href="mailto:support@bozorliii.online" className="font-semibold text-electric-500">
              support@bozorliii.online
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
