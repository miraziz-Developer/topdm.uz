"use client";

import Link from "next/link";
import { BozorliiiLogo } from "@/components/brand/bozorliii-logo";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white font-sans overflow-x-hidden">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0f0f0f]/90 backdrop-blur-md border-b border-white/5">
        <Link href="/" className="inline-flex items-center gap-2 select-none">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] font-black text-white text-[17px] leading-none"
            style={{
              background: "linear-gradient(135deg, #FF5A00 0%, #E91E8C 50%, #7B2FE4 100%)",
              boxShadow: "0 2px 12px rgba(233,30,140,0.45)",
            }}
          >
            B
          </div>
          <span className="font-black text-[18px] tracking-tight text-white leading-none">
            Bozor
            <span
              style={{
                background: "linear-gradient(90deg, #E91E8C, #7B2FE4)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              liii
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/auth"
            className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5"
          >
            Kirish
          </Link>
          <a
            href="https://t.me/Bozorliiicrm_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Do'konchi bo'lish
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-32 pb-20 px-5 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-transparent to-purple-950/30 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto">
    <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
      🇺🇿 O'zbekiston bozorlari uchun raqamli platforma
    </div>

    <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight mb-6">
      O'zbekiston<br />
      bozorlari —<br />
      <span className="text-indigo-400">endi onlaynda</span>
    </h1>

    <p className="text-lg sm:text-xl text-slate-400 max-w-xl mx-auto mb-10">
      Toshkent, Samarqand, Namangan, Andijon va boshqa shaharlardagi
      bozor do'konlarini onlaynda toping. Mahsulot qidiring, buyurtma bering.
    </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/market"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
            >
              🛍️ Xarid qilish
            </Link>
            <a
              href="https://t.me/Bozorliiicrm_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-lg px-8 py-4 rounded-xl transition-all"
            >
              📲 Do'konchi bo'lish
            </a>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-12 px-5 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { num: "14+", label: "Viloyat va shahar" },
            { num: "24/7", label: "Onlayn vitrina" },
            { num: "0 so'm", label: "Ro'yxatdan o'tish" },
            { num: "1 min", label: "Boshlash vaqti" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-black text-indigo-400">{s.num}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CITIES */}
      <section className="py-14 px-5 max-w-4xl mx-auto text-center">
        <div className="inline-block text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4 bg-indigo-500/10 px-3 py-1 rounded-full">Qayerda ishlaydi?</div>
        <h2 className="text-3xl sm:text-4xl font-black mb-8">
          Butun <span className="text-indigo-400">O'zbekiston</span> bo'ylab
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          {["🏙️ Toshkent", "🕌 Samarqand", "🌿 Namangan", "🌾 Andijon", "🏔️ Farg'ona", "🌊 Buxoro", "🌻 Qashqadaryo"].map((city) => (
            <span key={city} className="bg-white/[0.05] border border-white/10 px-4 py-2 rounded-full text-sm font-medium">{city}</span>
          ))}
          <span className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 px-4 py-2 rounded-full text-sm font-medium">+ boshqa shaharlar</span>
        </div>
      </section>

      {/* FOR BUYERS */}
      <section className="py-20 px-5 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-block text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">Xaridorlar uchun</div>
          <h2 className="text-3xl sm:text-4xl font-black">
            Bozorni <span className="text-indigo-400">uydan</span> ko'ring
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: "🔍", title: "AI qidiruv", desc: "Rasm yuklang — o'xshash mahsulotlar chiqadi. Matn bilan ham qidiring." },
            { icon: "🗺️", title: "Xarita", desc: "Do'konning aniq joyi. Bozor ichida navigatsiya. Adashmasdan toping." },
            { icon: "📦", title: "Buyurtma + QR", desc: "Onlayn bron qiling, do'konga boring, QR ko'rsating — tovar tayyor." },
            { icon: "📸", title: "Stories va Reels", desc: "Do'konchilarning yangi mahsulotlari, aksiyalar — Instagram kabi." },
            { icon: "🤖", title: "AI Stylist", desc: "Kiyim maslahati so'rang. AI sizga mos outfit tavsiya qiladi." },
            { icon: "💰", title: "Eng yaxshi narx", desc: "Bozor narxlari — vositachisiz, to'g'ridan-to'g'ri do'konchidan." },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 hover:border-indigo-500/30 hover:-translate-y-1 transition-all"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-base mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link
            href="/market"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3.5 rounded-xl transition-colors"
          >
            🛍️ Mahsulotlarni ko'rish
          </Link>
        </div>
      </section>

      {/* FOR MERCHANTS */}
      <section className="py-20 px-5 bg-gradient-to-br from-indigo-950/30 to-purple-950/20 border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block text-xs font-bold text-purple-400 uppercase tracking-widest mb-3">Do'konchilar uchun</div>
            <h2 className="text-3xl sm:text-4xl font-black">
              Savdoni <span className="text-purple-400">ko'paytiring</span>
            </h2>
            <p className="text-slate-400 mt-3 max-w-lg mx-auto">
              Bepul ro'yxatdan o'ting. Mahsulot qo'shing. Buyurtmalar Telegramga keladi.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {[
              { icon: "🌐", title: "Onlayn vitrina", desc: "Mahsulotlaringiz bozorliii.online da ko'rinadi. Butun O'zbekiston ko'radi." },
              { icon: "🔔", title: "Buyurtma → Telegram", desc: "Mijoz buyurtma beradi → Telegramga darhol xabar. Avtomatik." },
              { icon: "📊", title: "CRM Panel", desc: "Mahsulot, buyurtma, statistika, chat — barchasi bir joyda." },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-white/[0.04] border border-purple-500/15 rounded-2xl p-6"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-base mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/8 border border-indigo-500/20 rounded-2xl p-8 text-center max-w-lg mx-auto">
            <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Narx modeli</div>
            <div className="text-6xl font-black text-indigo-400 my-3">BEPUL</div>
            <div className="text-lg font-bold mb-2">Obuna yo'q · Oylik to'lov yo'q</div>
            <p className="text-sm text-slate-400 mb-6">
              Faqat muvaffaqiyatli sotuvdan kichik komissiya.<br />
              <span className="text-slate-500">Sotmadingizmi — hech narsa to'lamaysiz.</span>
            </p>
            <a
              href="https://t.me/Bozorliiicrm_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-8 py-3.5 rounded-xl transition-all"
            >
              📲 Hoziroq boshlash — BEPUL
            </a>
            <p className="text-xs text-green-400 mt-3 font-semibold">
              💡 Birinchi 100 do'konchi — komissiya ham yo'q!
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-5 max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black">
            Boshlash — <span className="text-indigo-400">3 qadam</span>
          </h2>
        </div>
        <div className="space-y-6">
          {[
            {
              num: "1",
              title: "Telegram botga yozing",
              desc: "Telefon raqamingizni yuboring — do'koningiz avtomatik yaratiladi",
              code: "@Bozorliiicrm_bot → /start",
            },
            {
              num: "2",
              title: "Mahsulotlaringizni qo'shing",
              desc: "CRM panelga kiring, rasm va narx qo'shing — 5 daqiqa",
              code: "crm.bozorliii.online",
            },
            {
              num: "3",
              title: "Buyurtmalar keladi!",
              desc: "Saytda ko'rinasiz → Mijozlar buyurtma beradi → Telegramga xabar keladi",
              code: "bozorliii.online",
            },
          ].map((step) => (
            <div key={step.num} className="flex gap-5 items-start">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-xl font-black flex-shrink-0">
                {step.num}
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">{step.title}</h3>
                <p className="text-sm text-slate-400 mb-2">{step.desc}</p>
                <code className="text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3 py-1 rounded-md">
                  {step.code}
                </code>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-center">
        <h2 className="text-3xl sm:text-4xl font-black mb-3">Hoziroq boshlang!</h2>
        <p className="text-indigo-100 mb-8 text-lg">
          Birinchi 100 do'konchi uchun — to'liq bepul
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/market"
            className="w-full sm:w-auto bg-white text-indigo-600 font-bold text-lg px-8 py-4 rounded-xl hover:bg-indigo-50 transition-colors"
          >
            🛍️ Xarid qilish
          </Link>
          <a
            href="https://t.me/Bozorliiicrm_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold text-lg px-8 py-4 rounded-xl transition-colors"
          >
            📲 Do'konchi bo'lish
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 px-5 bg-[#0a0a0a] text-center text-slate-500 text-sm">
        <div className="flex items-center justify-center gap-1 mb-2">
          <span className="font-black text-base"><span className="text-indigo-400">Bozor</span>liii</span>
        </div>
        <p>Abu Sahiy · Ippodrom · Kozgalovka</p>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs">
          <Link href="/market" className="hover:text-indigo-400 transition-colors">Bozor</Link>
          <Link href="/map" className="hover:text-indigo-400 transition-colors">Xarita</Link>
          <a href="https://crm.bozorliii.online" className="hover:text-indigo-400 transition-colors">CRM</a>
          <a href="https://t.me/Bozorliiicrm_bot" className="hover:text-indigo-400 transition-colors">Telegram</a>
        </div>
        <p className="mt-4 text-xs text-slate-600">© 2026 Bozorliii</p>
      </footer>

    </main>
  );
}
